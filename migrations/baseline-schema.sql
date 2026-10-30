--
-- PostgreSQL database dump
--

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg13+2)
-- Dumped by pg_dump version 18.6 (Debian 18.6-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', true);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';

--
-- Name: enum_subreddit_moderators_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_subreddit_moderators_role AS ENUM (
    'owner',
    'moderator',
    'moderator_limited'
);

--
-- Name: decrement_comment_ancestors(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_comment_ancestors() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    WITH RECURSIVE ancestors AS (
        SELECT id, comment_id
        FROM comments
        WHERE id = OLD.comment_id

        UNION ALL

        SELECT c.id, c.comment_id
        FROM comments c
        JOIN ancestors a
          ON c.id = a.comment_id
    )
    UPDATE comments c
    SET descendant_count = c.descendant_count - 1
    WHERE c.id IN (SELECT id FROM ancestors);

    RETURN OLD;
END;
$$;

--
-- Name: increment_comment_ancestors(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_comment_ancestors() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    WITH RECURSIVE ancestors AS (
        SELECT id, comment_id
        FROM comments
        WHERE id = NEW.comment_id

        UNION ALL

        SELECT c.id, c.comment_id
        FROM comments c
        JOIN ancestors a
          ON c.id = a.comment_id
    )
    UPDATE comments c
    SET descendant_count = c.descendant_count + 1
    WHERE c.id IN (SELECT id FROM ancestors);

    RETURN NEW;
END;
$$;

--
-- Name: maintain_post_comment_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_post_comment_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts
        SET comment_count = comment_count + 1
        WHERE id = NEW.post_id;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts
        SET comment_count = comment_count - 1
        WHERE id = OLD.post_id;
    END IF;

    RETURN NULL;
END;
$$;

--
-- Name: maintain_subreddit_member_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_subreddit_member_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE subreddits
        SET member_count = member_count + 1
        WHERE id = NEW.subreddit_id;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE subreddits
        SET member_count = member_count - 1
        WHERE id = OLD.subreddit_id;
    END IF;

    RETURN NULL;
END;
$$;

--
-- Name: update_user_karma_from_rated_votes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_karma_from_rated_votes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  old_owner_id INTEGER;
  new_owner_id INTEGER;
BEGIN
  IF TG_OP != 'INSERT' THEN
    IF TG_TABLE_NAME = 'user_rated_posts' THEN
      SELECT user_id INTO old_owner_id
      FROM posts
      WHERE id = OLD.post_id;
    ELSE
      SELECT user_id INTO old_owner_id
      FROM comments
      WHERE id = OLD.comment_id;
    END IF;

    IF OLD.user_id != old_owner_id THEN
      UPDATE users
      SET karma = karma - OLD.rating
      WHERE id = old_owner_id;
    END IF;
  END IF;

  IF TG_OP != 'DELETE' THEN
    IF TG_TABLE_NAME = 'user_rated_posts' THEN
      SELECT user_id INTO new_owner_id
      FROM posts
      WHERE id = NEW.post_id;
    ELSE
      SELECT user_id INTO new_owner_id
      FROM comments
      WHERE id = NEW.comment_id;
    END IF;

    IF NEW.user_id != new_owner_id THEN
      UPDATE users
      SET karma = karma + NEW.rating
      WHERE id = new_owner_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    up_votes integer DEFAULT 0 NOT NULL,
    down_votes integer DEFAULT 0 NOT NULL,
    direct_reply_to_post boolean NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    user_id integer,
    comment_id integer,
    post_id integer NOT NULL,
    descendant_count integer DEFAULT 0 NOT NULL
);

--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;

--
-- Name: email_verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_verification_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

--
-- Name: email_verification_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_verification_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: email_verification_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_verification_tokens_id_seq OWNED BY public.email_verification_tokens.id;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;

--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id integer NOT NULL,
    up_votes integer DEFAULT 0 NOT NULL,
    down_votes integer DEFAULT 0 NOT NULL,
    title text NOT NULL,
    text text NOT NULL,
    image_url text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    user_id integer NOT NULL,
    subreddit_id integer NOT NULL,
    comment_count integer DEFAULT 0 NOT NULL,
    embedding public.vector(512) NOT NULL
);

--
-- Name: posts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.posts_id_seq OWNED BY public.posts.id;

--
-- Name: subreddit_leaderboard_subreddits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subreddit_leaderboard_subreddits (
    id integer NOT NULL,
    subreddit_id integer NOT NULL,
    rank integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    subreddit_leaderboard_id integer CONSTRAINT subreddit_leaderboard_subredd_subreddit_leaderboard_id_not_null NOT NULL
);

--
-- Name: subreddit_leaderboard_subreddits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subreddit_leaderboard_subreddits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: subreddit_leaderboard_subreddits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subreddit_leaderboard_subreddits_id_seq OWNED BY public.subreddit_leaderboard_subreddits.id;

--
-- Name: subreddit_leaderboards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subreddit_leaderboards (
    id integer NOT NULL,
    date date NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

--
-- Name: subreddit_leaderboards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subreddit_leaderboards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: subreddit_leaderboards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subreddit_leaderboards_id_seq OWNED BY public.subreddit_leaderboards.id;

--
-- Name: subreddit_moderators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subreddit_moderators (
    id integer NOT NULL,
    user_id integer NOT NULL,
    subreddit_id integer NOT NULL,
    role public.enum_subreddit_moderators_role NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

--
-- Name: subreddit_moderators_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subreddit_moderators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: subreddit_moderators_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subreddit_moderators_id_seq OWNED BY public.subreddit_moderators.id;

--
-- Name: subreddits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subreddits (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    creator_id integer DEFAULT 1 NOT NULL,
    icon_url character varying(255),
    subreddit_page_background_image_url text,
    member_count integer DEFAULT 0 NOT NULL
);

--
-- Name: subreddits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subreddits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: subreddits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subreddits_id_seq OWNED BY public.subreddits.id;

--
-- Name: user_rated_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_rated_comments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    comment_id integer NOT NULL,
    rating integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

--
-- Name: user_rated_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_rated_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: user_rated_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_rated_comments_id_seq OWNED BY public.user_rated_comments.id;

--
-- Name: user_rated_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_rated_posts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    post_id integer NOT NULL,
    rating integer NOT NULL
);

--
-- Name: user_rated_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_rated_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: user_rated_posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_rated_posts_id_seq OWNED BY public.user_rated_posts.id;

--
-- Name: user_subreddits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_subreddits (
    id integer NOT NULL,
    user_id integer NOT NULL,
    subreddit_id integer NOT NULL
);

--
-- Name: user_subreddits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_subreddits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: user_subreddits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_subreddits_id_seq OWNED BY public.user_subreddits.id;

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    introduction text,
    avatar_image_url text,
    profile_page_background_image_url text,
    karma integer DEFAULT 0 NOT NULL,
    email character varying(255),
    email_verified boolean DEFAULT false NOT NULL
);

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);

--
-- Name: email_verification_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens ALTER COLUMN id SET DEFAULT nextval('public.email_verification_tokens_id_seq'::regclass);

--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);

--
-- Name: posts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts ALTER COLUMN id SET DEFAULT nextval('public.posts_id_seq'::regclass);

--
-- Name: subreddit_leaderboard_subreddits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddit_leaderboard_subreddits ALTER COLUMN id SET DEFAULT nextval('public.subreddit_leaderboard_subreddits_id_seq'::regclass);

--
-- Name: subreddit_leaderboards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddit_leaderboards ALTER COLUMN id SET DEFAULT nextval('public.subreddit_leaderboards_id_seq'::regclass);

--
-- Name: subreddit_moderators id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddit_moderators ALTER COLUMN id SET DEFAULT nextval('public.subreddit_moderators_id_seq'::regclass);

--
-- Name: subreddits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddits ALTER COLUMN id SET DEFAULT nextval('public.subreddits_id_seq'::regclass);

--
-- Name: user_rated_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rated_comments ALTER COLUMN id SET DEFAULT nextval('public.user_rated_comments_id_seq'::regclass);

--
-- Name: user_rated_posts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rated_posts ALTER COLUMN id SET DEFAULT nextval('public.user_rated_posts_id_seq'::regclass);

--
-- Name: user_subreddits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subreddits ALTER COLUMN id SET DEFAULT nextval('public.user_subreddits_id_seq'::regclass);

--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);

--
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);

--
-- Name: email_verification_tokens email_verification_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_token_hash_key UNIQUE (token_hash);

--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);

--
-- Name: password_reset_tokens password_reset_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);

--
-- Name: password_reset_tokens password_reset_tokens_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_key UNIQUE (user_id);

--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);

--
-- Name: subreddit_leaderboard_subreddits subreddit_leaderboard_subreddits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddit_leaderboard_subreddits
    ADD CONSTRAINT subreddit_leaderboard_subreddits_pkey PRIMARY KEY (id);

--
-- Name: subreddit_leaderboards subreddit_leaderboards_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddit_leaderboards
    ADD CONSTRAINT subreddit_leaderboards_date_key UNIQUE (date);

--
-- Name: subreddit_leaderboards subreddit_leaderboards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddit_leaderboards
    ADD CONSTRAINT subreddit_leaderboards_pkey PRIMARY KEY (id);

--
-- Name: subreddit_moderators subreddit_moderators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddit_moderators
    ADD CONSTRAINT subreddit_moderators_pkey PRIMARY KEY (id);

--
-- Name: subreddit_moderators subreddit_moderators_user_id_subreddit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddit_moderators
    ADD CONSTRAINT subreddit_moderators_user_id_subreddit_id_key UNIQUE (user_id, subreddit_id);

--
-- Name: subreddits subreddits_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddits
    ADD CONSTRAINT subreddits_name_key UNIQUE (name);

--
-- Name: subreddits subreddits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddits
    ADD CONSTRAINT subreddits_pkey PRIMARY KEY (id);

--
-- Name: user_rated_comments user_rated_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rated_comments
    ADD CONSTRAINT user_rated_comments_pkey PRIMARY KEY (id);

--
-- Name: user_rated_comments user_rated_comments_user_id_comment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rated_comments
    ADD CONSTRAINT user_rated_comments_user_id_comment_id_key UNIQUE (user_id, comment_id);

--
-- Name: user_rated_posts user_rated_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rated_posts
    ADD CONSTRAINT user_rated_posts_pkey PRIMARY KEY (id);

--
-- Name: user_rated_posts user_rated_posts_user_id_post_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rated_posts
    ADD CONSTRAINT user_rated_posts_user_id_post_id_key UNIQUE (user_id, post_id);

--
-- Name: user_subreddits user_subreddits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subreddits
    ADD CONSTRAINT user_subreddits_pkey PRIMARY KEY (id);

--
-- Name: user_subreddits user_subreddits_user_id_subreddit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subreddits
    ADD CONSTRAINT user_subreddits_user_id_subreddit_id_key UNIQUE (user_id, subreddit_id);

--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);

--
-- Name: idx_comment_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_parent ON public.comments USING btree (comment_id);

--
-- Name: posts_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_embedding_idx ON public.posts USING hnsw (embedding public.vector_cosine_ops);

--
-- Name: posts_text_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_text_trgm_idx ON public.posts USING gin (text public.gin_trgm_ops);

--
-- Name: posts_title_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_title_trgm_idx ON public.posts USING gin (title public.gin_trgm_ops);

--
-- Name: subreddit_leaderboard_subreddits_subreddit_leaderboard_id_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subreddit_leaderboard_subreddits_subreddit_leaderboard_id_rank ON public.subreddit_leaderboard_subreddits USING btree (subreddit_leaderboard_id, rank);

--
-- Name: subreddit_leaderboard_subreddits_subreddit_leaderboard_id_subre; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subreddit_leaderboard_subreddits_subreddit_leaderboard_id_subre ON public.subreddit_leaderboard_subreddits USING btree (subreddit_leaderboard_id, subreddit_id);

--
-- Name: subreddit_moderators_subreddit_id_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subreddit_moderators_subreddit_id_user_id ON public.subreddit_moderators USING btree (subreddit_id, user_id);

--
-- Name: user_rated_comments_comment_id_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_rated_comments_comment_id_user_id ON public.user_rated_comments USING btree (comment_id, user_id);

--
-- Name: user_rated_posts_post_id_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_rated_posts_post_id_user_id ON public.user_rated_posts USING btree (post_id, user_id);

--
-- Name: user_subreddits_subreddit_id_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_subreddits_subreddit_id_user_id ON public.user_subreddits USING btree (subreddit_id, user_id);

--
-- Name: comments comment_after_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER comment_after_delete AFTER DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.decrement_comment_ancestors();

--
-- Name: comments comment_after_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER comment_after_insert AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.increment_comment_ancestors();

--
-- Name: comments comments_maintain_post_comment_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER comments_maintain_post_comment_count AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.maintain_post_comment_count();

--
-- Name: user_rated_comments user_rated_comments_update_karma; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_rated_comments_update_karma AFTER INSERT OR DELETE OR UPDATE ON public.user_rated_comments FOR EACH ROW EXECUTE FUNCTION public.update_user_karma_from_rated_votes();

--
-- Name: user_rated_posts user_rated_posts_update_karma; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_rated_posts_update_karma AFTER INSERT OR DELETE OR UPDATE ON public.user_rated_posts FOR EACH ROW EXECUTE FUNCTION public.update_user_karma_from_rated_votes();

--
-- Name: user_subreddits user_subreddits_maintain_subreddit_member_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_subreddits_maintain_subreddit_member_count AFTER INSERT OR DELETE ON public.user_subreddits FOR EACH ROW EXECUTE FUNCTION public.maintain_subreddit_member_count();

--
-- Name: comments comments_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE;

--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: subreddit_leaderboard_subreddits subreddit_leaderboard_subreddits_subreddit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddit_leaderboard_subreddits
    ADD CONSTRAINT subreddit_leaderboard_subreddits_subreddit_id_fkey FOREIGN KEY (subreddit_id) REFERENCES public.subreddits(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: subreddit_leaderboard_subreddits subreddit_leaderboard_subreddits_subreddit_leaderboard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddit_leaderboard_subreddits
    ADD CONSTRAINT subreddit_leaderboard_subreddits_subreddit_leaderboard_id_fkey FOREIGN KEY (subreddit_leaderboard_id) REFERENCES public.subreddit_leaderboards(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: subreddit_moderators subreddit_moderators_subreddit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddit_moderators
    ADD CONSTRAINT subreddit_moderators_subreddit_id_fkey FOREIGN KEY (subreddit_id) REFERENCES public.subreddits(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: subreddit_moderators subreddit_moderators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddit_moderators
    ADD CONSTRAINT subreddit_moderators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: subreddits subreddits_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subreddits
    ADD CONSTRAINT subreddits_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id);

--
-- Name: user_rated_comments user_rated_comments_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rated_comments
    ADD CONSTRAINT user_rated_comments_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: user_rated_posts user_rated_posts_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rated_posts
    ADD CONSTRAINT user_rated_posts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- PostgreSQL database dump complete
--
