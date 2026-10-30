-- TiDB Cloud read-only verification after applying 20261019_member_bulk_edit_restore_tidb.sql.
SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('network_member_bulk_edit_batches','network_member_bulk_edit_items','seller_manager_replacement_reversals') ORDER BY TABLE_NAME;
SELECT COUNT(*) AS bulk_change_batches FROM network_member_bulk_edit_batches;
SELECT COUNT(*) AS bulk_change_items FROM network_member_bulk_edit_items;
SELECT COUNT(*) AS restored_replacements FROM seller_manager_replacement_reversals;
SELECT s.seller_group_id,s.seller_group_name,s.seller_group_head_user_id FROM seller_groups s WHERE s.seller_group_type='in_house' ORDER BY s.seller_group_id LIMIT 20;

