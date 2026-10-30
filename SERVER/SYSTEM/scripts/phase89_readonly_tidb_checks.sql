-- D&C Prime Realty / Phase 9 / READ-ONLY TiDB staging integrity checks
-- These SELECT statements never alter seller, buyer, payment or commission data.
-- Run only AFTER the Phase 5-7 migrations exist. Investigate nonzero counts.
-- Do not use screenshots containing personal data in issue trackers.

-- A. User active / seller inactive and vice versa. Review exceptions manually.
SELECT 'status_mismatch' AS check_name, COUNT(*) AS finding_count
FROM accredited_sellers s JOIN users u ON u.id=s.user_id
WHERE COALESCE(s.is_system_dummy,0)=0 AND s.accredited_seller_status<>u.status;

-- B. Active In-House seller with missing/wrong/inactive reporting parent.
SELECT 'active_seller_invalid_direct_parent' AS check_name, COUNT(*) AS finding_count
FROM accredited_sellers s
JOIN users u ON u.id=s.user_id
JOIN seller_groups g ON g.seller_group_id=s.seller_group_id AND g.seller_group_type='in_house'
LEFT JOIN users pu ON pu.id=s.accredited_seller_reports_under_user_id
LEFT JOIN accredited_sellers ps ON ps.user_id=pu.id
WHERE s.accredited_seller_status='active' AND u.status='active'
AND COALESCE(s.is_system_dummy,0)=0 AND u.role IN ('sales_agent','unit_manager','sales_director')
AND (pu.id IS NULL OR ps.accredited_seller_id IS NULL OR pu.status<>'active'
  OR ps.accredited_seller_status<>'active' OR ps.seller_group_id<>s.seller_group_id
  OR (u.role='sales_agent' AND pu.role<>'unit_manager')
  OR (u.role='unit_manager' AND pu.role<>'sales_director')
  OR (u.role='sales_director' AND pu.role<>'division_manager'));

-- C. Network head not active, not a DM, or not in that same Network.
SELECT 'invalid_inhouse_network_head' AS check_name, COUNT(*) AS finding_count
FROM seller_groups g
LEFT JOIN users head ON head.id=g.seller_group_head_user_id
LEFT JOIN accredited_sellers sh ON sh.user_id=head.id
WHERE g.seller_group_type='in_house' AND g.seller_group_status='active'
AND (head.id IS NULL OR head.status<>'active' OR head.role<>'division_manager'
  OR sh.accredited_seller_status<>'active' OR sh.seller_group_id<>g.seller_group_id);

-- D. Manager replacement without an existing Review ID or corresponding record.
SELECT 'replacement_missing_review' AS check_name, COUNT(*) AS finding_count
FROM seller_manager_replacements mr
LEFT JOIN operational_reviews r ON r.operational_review_id=mr.operational_review_id
WHERE mr.operational_review_id IS NULL OR r.operational_review_id IS NULL;

-- E. Manager replacement item count inconsistent with recorded moved count.
SELECT 'replacement_count_mismatch' AS check_name, COUNT(*) AS finding_count
FROM seller_manager_replacements mr LEFT JOIN (
 SELECT replacement_id,COUNT(*) AS total FROM seller_manager_replacement_items GROUP BY replacement_id
) moved ON moved.replacement_id=mr.replacement_id
WHERE mr.direct_reports_moved<>COALESCE(moved.total,0);

-- F. Assigned seller changes that are missing historical snapshots.
SELECT 'seller_change_missing_snapshot' AS check_name, COUNT(*) AS finding_count
FROM lot_project_assigned_seller_changes c
WHERE c.before_snapshot_json IS NULL OR c.after_snapshot_json IS NULL;

-- G. Phase 8 new manager audit logs without a Review link (older events may exist).
SELECT 'manager_audit_missing_review_link' AS check_name, COUNT(*) AS finding_count
FROM audit_logs a WHERE a.title='Replaced and deactivated manager'
AND JSON_UNQUOTE(JSON_EXTRACT(a.metadata_json,'$.reviewId')) IS NULL;

-- H. Phase 8 new assigned seller audit logs without a Review link (older events may exist).
SELECT 'seller_change_audit_missing_review_link' AS check_name, COUNT(*) AS finding_count
FROM audit_logs a WHERE a.title='Changed assigned seller'
AND JSON_UNQUOTE(JSON_EXTRACT(a.metadata_json,'$.reviewId')) IS NULL;

