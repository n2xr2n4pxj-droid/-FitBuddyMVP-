--
-- PostgreSQL database dump
--

\restrict xjBPo1iEhQwEILjxCn7SOfYXB1J8qVFqjBnd71ude4v8XPBwBrgraUd7eGHZrkt

-- Dumped from database version 14.20 (Homebrew)
-- Dumped by pg_dump version 14.20 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: invitation_status; Type: TYPE; Schema: public; Owner: gordon
--

CREATE TYPE public.invitation_status AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'EXPIRED'
);


ALTER TYPE public.invitation_status OWNER TO gordon;

--
-- Name: relationship_status; Type: TYPE; Schema: public; Owner: gordon
--

CREATE TYPE public.relationship_status AS ENUM (
    'ACTIVE',
    'PAUSED',
    'TERMINATED'
);


ALTER TYPE public.relationship_status OWNER TO gordon;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: coach_client_relationships; Type: TABLE; Schema: public; Owner: gordon
--

CREATE TABLE public.coach_client_relationships (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    coach_id integer NOT NULL,
    client_id integer NOT NULL,
    status public.relationship_status DEFAULT 'ACTIVE'::public.relationship_status NOT NULL,
    notes text,
    start_date timestamp with time zone DEFAULT now() NOT NULL,
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.coach_client_relationships OWNER TO gordon;

--
-- Name: coach_clients; Type: TABLE; Schema: public; Owner: gordon
--

CREATE TABLE public.coach_clients (
    id integer NOT NULL,
    coach_id integer NOT NULL,
    client_id integer NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.coach_clients OWNER TO gordon;

--
-- Name: coach_clients_id_seq; Type: SEQUENCE; Schema: public; Owner: gordon
--

CREATE SEQUENCE public.coach_clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.coach_clients_id_seq OWNER TO gordon;

--
-- Name: coach_clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gordon
--

ALTER SEQUENCE public.coach_clients_id_seq OWNED BY public.coach_clients.id;


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: gordon
--

CREATE TABLE public.email_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id integer,
    recipient_email character varying(255) NOT NULL,
    subject character varying(255) NOT NULL,
    message_id character varying(255),
    status character varying(50) DEFAULT 'sent'::character varying NOT NULL,
    error_message text,
    sent_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    type character varying(50) DEFAULT 'general'::character varying
);


ALTER TABLE public.email_logs OWNER TO gordon;

--
-- Name: TABLE email_logs; Type: COMMENT; Schema: public; Owner: gordon
--

COMMENT ON TABLE public.email_logs IS '記錄所有發送的郵件，包括邀請郵件和驗證郵件';


--
-- Name: COLUMN email_logs.id; Type: COMMENT; Schema: public; Owner: gordon
--

COMMENT ON COLUMN public.email_logs.id IS '唯一標識符';


--
-- Name: COLUMN email_logs.coach_id; Type: COMMENT; Schema: public; Owner: gordon
--

COMMENT ON COLUMN public.email_logs.coach_id IS '發送者（教練）ID，可選';


--
-- Name: COLUMN email_logs.recipient_email; Type: COMMENT; Schema: public; Owner: gordon
--

COMMENT ON COLUMN public.email_logs.recipient_email IS '收件人郵箱地址';


--
-- Name: COLUMN email_logs.subject; Type: COMMENT; Schema: public; Owner: gordon
--

COMMENT ON COLUMN public.email_logs.subject IS '郵件主題';


--
-- Name: COLUMN email_logs.message_id; Type: COMMENT; Schema: public; Owner: gordon
--

COMMENT ON COLUMN public.email_logs.message_id IS 'SendGrid 返回的 message ID';


--
-- Name: COLUMN email_logs.status; Type: COMMENT; Schema: public; Owner: gordon
--

COMMENT ON COLUMN public.email_logs.status IS '郵件狀態：sent, failed, bounced, delivered 等';


--
-- Name: COLUMN email_logs.error_message; Type: COMMENT; Schema: public; Owner: gordon
--

COMMENT ON COLUMN public.email_logs.error_message IS '如果發送失敗，存放錯誤信息';


--
-- Name: COLUMN email_logs.sent_at; Type: COMMENT; Schema: public; Owner: gordon
--

COMMENT ON COLUMN public.email_logs.sent_at IS '郵件發送時間';


--
-- Name: COLUMN email_logs.created_at; Type: COMMENT; Schema: public; Owner: gordon
--

COMMENT ON COLUMN public.email_logs.created_at IS '記錄建立時間';


--
-- Name: invitation_templates; Type: TABLE; Schema: public; Owner: gordon
--

CREATE TABLE public.invitation_templates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    coach_id integer NOT NULL,
    name character varying(50) NOT NULL,
    message text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invitation_templates OWNER TO gordon;

--
-- Name: invitations; Type: TABLE; Schema: public; Owner: gordon
--

CREATE TABLE public.invitations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    sender_id integer NOT NULL,
    receiver_email text NOT NULL,
    receiver_id integer,
    invitation_type text NOT NULL,
    status public.invitation_status DEFAULT 'PENDING'::public.invitation_status NOT NULL,
    message text,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone
);


ALTER TABLE public.invitations OWNER TO gordon;

--
-- Name: users; Type: TABLE; Schema: public; Owner: gordon
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    role character varying(50) DEFAULT 'client'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    avatar character varying(255),
    email_verification_token text,
    email_verified boolean DEFAULT false NOT NULL,
    email_verification_expires bigint
);


ALTER TABLE public.users OWNER TO gordon;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: gordon
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO gordon;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gordon
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: coach_clients id; Type: DEFAULT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.coach_clients ALTER COLUMN id SET DEFAULT nextval('public.coach_clients_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: coach_client_relationships; Type: TABLE DATA; Schema: public; Owner: gordon
--

COPY public.coach_client_relationships (id, coach_id, client_id, status, notes, start_date, end_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: coach_clients; Type: TABLE DATA; Schema: public; Owner: gordon
--

COPY public.coach_clients (id, coach_id, client_id, status, created_at) FROM stdin;
\.


--
-- Data for Name: email_logs; Type: TABLE DATA; Schema: public; Owner: gordon
--

COPY public.email_logs (id, coach_id, recipient_email, subject, message_id, status, error_message, sent_at, created_at, type) FROM stdin;
1f33576a-1f77-44f2-a67b-8c60067c0754	\N	hoka3787@gmail.com	驗證您的 FitBuddy 郵箱	7r7H0jWOTViApwWj3-Z1YA	sent	\N	2026-01-03 18:29:41.044	2026-01-04 02:29:41.04549	verification
b9d2bf57-9394-4251-940b-fcf5202ed55a	\N	gordonlai87@gmail.com	驗證您的 FitBuddy 郵箱	UUdvmvOuRf6egA-fzfs7SQ	sent	\N	2026-01-04 12:33:49.406	2026-01-04 20:33:49.407984	verification
5c44769a-3355-4e93-be62-d9c1eaabadc7	\N	gordonlai87@gmail.com	驗證您的 FitBuddy 郵箱	Ns-n4BHRS26GCm8rfszTfg	sent	\N	2026-01-04 12:57:04.123	2026-01-04 20:57:04.124932	verification
10855bb6-e257-4c13-9a92-30ba01688d5a	\N	gordonlai87@gmail.com	驗證您的 FitBuddy 郵箱	YUoQnI3MSWaksnMvoahqYg	sent	\N	2026-01-04 13:38:52.041	2026-01-04 21:38:52.043393	verification
288003a5-17ea-465c-b60a-87ff706d9fe6	\N	hoka3787@gmail.com	驗證您的 FitBuddy 郵箱	376lWowoRpy_vOPxsmfF5g	sent	\N	2026-01-04 13:45:45.54	2026-01-04 21:45:45.541793	verification
423e7abf-5da5-4a02-acca-5227ca330121	\N	hoka3787@gmail.com	驗證您的 FitBuddy 郵箱	IPAx93wrQ_u96M09sGhNhA	sent	\N	2026-01-04 13:46:10.727	2026-01-04 21:46:10.729561	verification
\.


--
-- Data for Name: invitation_templates; Type: TABLE DATA; Schema: public; Owner: gordon
--

COPY public.invitation_templates (id, coach_id, name, message, is_default, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: invitations; Type: TABLE DATA; Schema: public; Owner: gordon
--

COPY public.invitations (id, sender_id, receiver_email, receiver_id, invitation_type, status, message, token, expires_at, created_at, responded_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: gordon
--

COPY public.users (id, email, password_hash, first_name, last_name, role, created_at, updated_at, avatar, email_verification_token, email_verified, email_verification_expires) FROM stdin;
33	hoka3787@gmail.com	f80734e4909beab4c3d3a1c9f044c566:6902a32d426f524fadf8726fa6e1e86fe329633191626d67fc4153d3681343ad5c07ab2ddafbc6d0456c2c085a7369f5dcef08c4bb6462ca181a995e629f10c0	d	q	client	2026-01-04 21:45:44.74683	2026-01-04 13:46:10.516	\N	611d1eeeea915f576169bd42fecb31434acc5895fcaa8f4206f655a4862b892b	f	1767620770516
32	gordonlai87@gmail.com	9d0f98c9f58087bbaf48b45b2f26dd70:a99035dad8a80be768417ee544be508c7484f3656e4a413f8fe7648f808e50c49a43e3259daed11b20904848ad0a1054ff294ea25eda6aad32052e14c7099271	w	q	coach	2026-01-04 21:38:47.171685	2026-01-04 18:34:11.736	https://lh3.googleusercontent.com/a/ACg8ocKv4vk76drkE4LW3IFGyymTYVYVKc1_D1-GL3S6ixdrv4DsDw=s96-c	\N	t	\N
\.


--
-- Name: coach_clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gordon
--

SELECT pg_catalog.setval('public.coach_clients_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gordon
--

SELECT pg_catalog.setval('public.users_id_seq', 33, true);


--
-- Name: coach_client_relationships coach_client_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.coach_client_relationships
    ADD CONSTRAINT coach_client_relationships_pkey PRIMARY KEY (id);


--
-- Name: coach_clients coach_clients_coach_id_client_id_key; Type: CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.coach_clients
    ADD CONSTRAINT coach_clients_coach_id_client_id_key UNIQUE (coach_id, client_id);


--
-- Name: coach_clients coach_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.coach_clients
    ADD CONSTRAINT coach_clients_pkey PRIMARY KEY (id);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: invitation_templates invitation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.invitation_templates
    ADD CONSTRAINT invitation_templates_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_token_unique; Type: CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_token_unique UNIQUE (token);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: coach_client_relationships_client_idx; Type: INDEX; Schema: public; Owner: gordon
--

CREATE INDEX coach_client_relationships_client_idx ON public.coach_client_relationships USING btree (client_id);


--
-- Name: coach_client_relationships_coach_idx; Type: INDEX; Schema: public; Owner: gordon
--

CREATE INDEX coach_client_relationships_coach_idx ON public.coach_client_relationships USING btree (coach_id);


--
-- Name: coach_client_relationships_status_idx; Type: INDEX; Schema: public; Owner: gordon
--

CREATE INDEX coach_client_relationships_status_idx ON public.coach_client_relationships USING btree (status);


--
-- Name: coach_client_relationships_unique; Type: INDEX; Schema: public; Owner: gordon
--

CREATE UNIQUE INDEX coach_client_relationships_unique ON public.coach_client_relationships USING btree (coach_id, client_id);


--
-- Name: idx_email_logs_coach_id; Type: INDEX; Schema: public; Owner: gordon
--

CREATE INDEX idx_email_logs_coach_id ON public.email_logs USING btree (coach_id);


--
-- Name: idx_email_logs_message_id; Type: INDEX; Schema: public; Owner: gordon
--

CREATE INDEX idx_email_logs_message_id ON public.email_logs USING btree (message_id);


--
-- Name: idx_email_logs_recipient_email; Type: INDEX; Schema: public; Owner: gordon
--

CREATE INDEX idx_email_logs_recipient_email ON public.email_logs USING btree (recipient_email);


--
-- Name: idx_email_logs_sent_at; Type: INDEX; Schema: public; Owner: gordon
--

CREATE INDEX idx_email_logs_sent_at ON public.email_logs USING btree (sent_at);


--
-- Name: idx_email_logs_status; Type: INDEX; Schema: public; Owner: gordon
--

CREATE INDEX idx_email_logs_status ON public.email_logs USING btree (status);


--
-- Name: invitation_templates_coach_idx; Type: INDEX; Schema: public; Owner: gordon
--

CREATE INDEX invitation_templates_coach_idx ON public.invitation_templates USING btree (coach_id);


--
-- Name: invitation_templates_unique_coach_name; Type: INDEX; Schema: public; Owner: gordon
--

CREATE UNIQUE INDEX invitation_templates_unique_coach_name ON public.invitation_templates USING btree (coach_id, name);


--
-- Name: invitations_receiver_email_idx; Type: INDEX; Schema: public; Owner: gordon
--

CREATE INDEX invitations_receiver_email_idx ON public.invitations USING btree (receiver_email);


--
-- Name: invitations_sender_idx; Type: INDEX; Schema: public; Owner: gordon
--

CREATE INDEX invitations_sender_idx ON public.invitations USING btree (sender_id);


--
-- Name: invitations_status_idx; Type: INDEX; Schema: public; Owner: gordon
--

CREATE INDEX invitations_status_idx ON public.invitations USING btree (status);


--
-- Name: invitations_token_idx; Type: INDEX; Schema: public; Owner: gordon
--

CREATE INDEX invitations_token_idx ON public.invitations USING btree (token);


--
-- Name: coach_client_relationships coach_client_relationships_client_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.coach_client_relationships
    ADD CONSTRAINT coach_client_relationships_client_id_users_id_fk FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: coach_client_relationships coach_client_relationships_coach_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.coach_client_relationships
    ADD CONSTRAINT coach_client_relationships_coach_id_users_id_fk FOREIGN KEY (coach_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: coach_clients coach_clients_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.coach_clients
    ADD CONSTRAINT coach_clients_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: coach_clients coach_clients_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.coach_clients
    ADD CONSTRAINT coach_clients_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.users(id);


--
-- Name: invitation_templates invitation_templates_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.invitation_templates
    ADD CONSTRAINT invitation_templates_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_receiver_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_receiver_id_users_id_fk FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_sender_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: gordon
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_sender_id_users_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict xjBPo1iEhQwEILjxCn7SOfYXB1J8qVFqjBnd71ude4v8XPBwBrgraUd7eGHZrkt

