
-- Storage policies for campaign-images bucket
CREATE POLICY "Anyone can view campaign images"
ON storage.objects FOR SELECT
USING (bucket_id = 'campaign-images');

CREATE POLICY "Admins can upload campaign images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'campaign-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update campaign images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'campaign-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete campaign images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'campaign-images' AND public.has_role(auth.uid(), 'admin'));
