CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL CHECK (report_type IN ('lost','found')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  category text NOT NULL,
  location text NOT NULL,
  location_detail text CHECK (location_detail IS NULL OR char_length(location_detail) <= 120),
  event_date date NOT NULL,
  description text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 1000),
  image_url text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_at timestamptz,
  reporter_name text NOT NULL CHECK (char_length(reporter_name) BETWEEN 2 AND 60),
  contact_email text NOT NULL,
  manage_token_hash text NOT NULL,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX items_created_idx ON public.items (created_at DESC);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  sender_name text NOT NULL CHECK (char_length(sender_name) BETWEEN 2 AND 60),
  sender_contact text NOT NULL CHECK (char_length(sender_contact) BETWEEN 5 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 5 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.items TO service_role;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
-- No public policies: all access goes through server functions so private fields never leak.

INSERT INTO public.items (report_type,title,category,location,location_detail,event_date,description,reporter_name,contact_email,manage_token_hash,is_sample,created_at) VALUES
('lost','Black Dell Laptop Charger','Electronics','Library','2nd floor reading hall', current_date - 2,'65W Dell charger with a small blue sticker on the brick. Left it plugged in near the window desks.','Ananya (sample)','sample@campusfind.local',md5(random()::text),true, now() - interval '2 days'),
('found','Student ID Card','ID & Documents','Canteen',NULL, current_date - 1,'Found a student ID card under a table near the juice counter. Handed nothing over yet, contact me to claim.','Rahul (sample)','sample@campusfind.local',md5(random()::text),true, now() - interval '1 day'),
('lost','Blue Hydro Flask Bottle','Other','Sports Ground','Near the basketball court', current_date - 4,'Navy blue 750ml steel bottle with a few stickers of bands on it. Probably left on the bench after practice.','Meera (sample)','sample@campusfind.local',md5(random()::text),true, now() - interval '4 days'),
('found','Set of Keys with Red Keychain','Keys','Parking Area','Two-wheeler section', current_date,'Three keys on a ring with a red rubber keychain shaped like a car. Found next to the bike stand.','Arjun (sample)','sample@campusfind.local',md5(random()::text),true, now() - interval '3 hours'),
('lost','Engineering Mathematics Textbook','Books & Stationery','Main Block','Room 204', current_date - 6,'B.S. Grewal Higher Engineering Mathematics, name written on the first page, lots of pencil notes inside.','Karthik (sample)','sample@campusfind.local',md5(random()::text),true, now() - interval '6 days'),
('found','Brown Leather Wallet','Bags & Wallets','Hostel Area','Outside Block C mess', current_date - 3,'Brown leather wallet with some cash and a metro card. Describe the contents to claim it.','Priya (sample)','sample@campusfind.local',md5(random()::text),true, now() - interval '3 days');