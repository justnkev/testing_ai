-- Promote justnkev@gmail.com to Admin
UPDATE public.profiles
SET role = 'admin'
FROM auth.users
WHERE public.profiles.id = auth.users.id
AND auth.users.email = 'justnkev@gmail.com';
