type OverviewFeedRowBase = {
  createdAt: Date;
  subreddit: { name: string; iconUrl: string | null };
  user: { username: string };
};

// data fields are JSON-built in SQL, so timestamps arrive as ISO strings
export type OverviewFeedRow =
  | (OverviewFeedRowBase & {
      type: "post";
      data: {
        id: number;
        title: string;
        imageUrl: string | null;
        upVotes: number;
        downVotes: number;
        commentCount: number;
        createdAt: string;
      };
      post: null;
    })
  | (OverviewFeedRowBase & {
      type: "comment";
      data: {
        id: number;
        text: string;
        upVotes: number;
        downVotes: number;
        createdAt: string;
        parentComment: {
          id: number;
          user: { username: string } | null;
        } | null;
      };
      post: { id: number; title: string };
    });

export const getUserPageOverviewPageFeedQuery = `
WITH combined AS (
  SELECT
    jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'imageUrl', p.image_url,
      'upVotes', p.up_votes,
      'downVotes', p.down_votes,
      'commentCount', p.comment_count,
      'createdAt', p.created_at
    ) AS data,
    p.created_at AS "createdAt",
    'post' AS type,
    jsonb_build_object(
      'name', s.name,
      'iconUrl', s.icon_url
    ) AS subreddit,
    jsonb_build_object('username', author.username) AS "user",
    NULL::jsonb AS post
  FROM posts AS p
  JOIN subreddits AS s ON s.id = p.subreddit_id
  JOIN users AS author ON author.id = p.user_id
  WHERE p.user_id = :userId and p.safe = true

  UNION ALL

  SELECT
    jsonb_build_object(
      'id', c.id,
      'text', c.text,
      'upVotes', c.up_votes,
      'downVotes', c.down_votes,
      'createdAt', c.created_at,
      'parentComment',
      CASE
        WHEN parent_comment.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', parent_comment.id,
          'user',
          CASE
            WHEN parent_author.id IS NULL THEN NULL
            ELSE jsonb_build_object('username', parent_author.username)
          END
        )
      END
    ) AS data,
    c.created_at AS "createdAt",
    'comment' AS type,
    jsonb_build_object(
      'name', s.name,
      'iconUrl', s.icon_url
    ) AS subreddit,
    jsonb_build_object('username', author.username) AS "user",
    jsonb_build_object(
      'id', p.id,
      'title', p.title
    ) AS post
  FROM comments AS c
  JOIN posts AS p ON p.id = c.post_id
  JOIN subreddits AS s ON s.id = p.subreddit_id
  JOIN users AS author ON author.id = c.user_id
  LEFT JOIN comments AS parent_comment ON parent_comment.id = c.comment_id
  LEFT JOIN users AS parent_author ON parent_author.id = parent_comment.user_id
  WHERE c.user_id = :userId
)
SELECT
  data,
  type,
  "createdAt",
  subreddit,
  "user",
  post
FROM combined
ORDER BY "createdAt" DESC
LIMIT 18
OFFSET :offset;
`;
