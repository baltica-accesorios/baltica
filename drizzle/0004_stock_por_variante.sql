ALTER TABLE "products" ADD COLUMN "variant_stock" jsonb;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "variant" text;--> statement-breakpoint
-- Productos que ya tenían talles: el stock total se reparte entre las opciones (después se corrige con el conteo o la migración)
UPDATE "products" p SET "variant_stock" = sub.vs FROM (
  SELECT id, jsonb_object_agg(opt, (stock / n) + CASE WHEN idx <= stock % n THEN 1 ELSE 0 END) AS vs
  FROM (
    SELECT id, stock, opt, idx, jsonb_array_length(variants->'options') AS n
    FROM "products", jsonb_array_elements_text(variants->'options') WITH ORDINALITY AS t(opt, idx)
    WHERE variants IS NOT NULL AND jsonb_array_length(variants->'options') > 0
  ) x GROUP BY id
) sub WHERE p.id = sub.id;
