UPDATE opportunities
SET editorial_status = 'published'
WHERE visibility = 'public'
  AND published_at IS NOT NULL
  AND editorial_status = 'draft';
