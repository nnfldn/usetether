-- Sinkronisasi auth.users -> public.profiles (gotcha yang sudah diriset,
-- lihat memori teknis proyek). Supabase Auth menyimpan pengguna di skema
-- `auth`, terpisah dari skema `public` yang dikelola Prisma — Prisma TIDAK
-- BISA mendeklarasikan foreign key langsung ke auth.users, jadi disinkron
-- lewat trigger Postgres saat pengguna baru mendaftar.
--
-- fullName sengaja diambil dari raw_user_meta_data->>'full_name' (dikirim
-- form pendaftaran sebagai signUp option.data), dengan fallback ke email
-- supaya trigger tidak pernah gagal insert kalau field itu kosong.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, "fullName", interests, "createdAt", "updatedAt")
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'Pengguna baru'),
    '{}',
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
