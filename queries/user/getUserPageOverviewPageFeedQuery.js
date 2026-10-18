export const getUserPageOverviewPageFeedQuery = `
WITH combined AS (
  SELECT
    (
      SELECT jsonb_object_agg(
        CASE e.key
          WHEN 'user_id' THEN 'userId'
          WHEN 'subreddit_id' THEN 'subredditId'
          WHEN 'up_votes' THEN 'upVotes'
          WHEN 'down_votes' THEN 'downVotes'
          WHEN 'image_url' THEN 'imageUrl'
          WHEN 'comment_count' THEN 'commentCount'
          WHEN 'created_at' THEN 'createdAt'
          WHEN 'updated_at' THEN 'updatedAt'
          ELSE e.key
        END,
        e.value
      )
      FROM jsonb_each(to_jsonb(p)) AS e(key, value)
    ) AS data,
    p.created_at AS "createdAt",
    'post' AS type,
    CASE
      WHEN s.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'name', s.name,
        'iconUrl', s.icon_url
      )
    END AS subreddit,
    CASE
      WHEN author.id IS NULL THEN NULL
      ELSE jsonb_build_object('username', author.username)
    END AS "user",
    NULL::jsonb AS post
  FROM posts AS p
  LEFT JOIN subreddits AS s ON s.id = p.subreddit_id
  LEFT JOIN users AS author ON author.id = p.user_id
  WHERE p.user_id = :userId

  UNION ALL

  SELECT
    (
      SELECT jsonb_object_agg(
        CASE e.key
          WHEN 'post_id' THEN 'postId'
          WHEN 'up_votes' THEN 'upVotes'
          WHEN 'down_votes' THEN 'downVotes'
          WHEN 'direct_reply_to_post' THEN 'directReplyToPost'
          WHEN 'descendant_count' THEN 'descendantCount'
          WHEN 'created_at' THEN 'createdAt'
          WHEN 'updated_at' THEN 'updatedAt'
          WHEN 'user_id' THEN 'userId'
          WHEN 'comment_id' THEN 'commentId'
          ELSE e.key
        END,
        e.value
      )
      FROM jsonb_each(to_jsonb(c)) AS e(key, value)
    ) || jsonb_build_object(
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
    CASE
      WHEN s.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'name', s.name,
        'iconUrl', s.icon_url
      )
    END AS subreddit,
    CASE
      WHEN author.id IS NULL THEN NULL
      ELSE jsonb_build_object('username', author.username)
    END AS "user",
    CASE
      WHEN p.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', p.id,
        'title', p.title
      )
    END AS post
  FROM comments AS c
  LEFT JOIN posts AS p ON p.id = c.post_id
  LEFT JOIN subreddits AS s ON s.id = p.subreddit_id
  LEFT JOIN users AS author ON author.id = c.user_id
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
LIMIT 100
OFFSET :offset;
`;
