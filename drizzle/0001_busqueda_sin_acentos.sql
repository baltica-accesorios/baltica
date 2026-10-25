-- Búsqueda de la tienda sin distinguir mayúsculas ni acentos ("anillo plata" encuentra "Anillo Plata Ñandú")
CREATE OR REPLACE FUNCTION unaccent_lower(t text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT translate(lower(t), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc') $$;
