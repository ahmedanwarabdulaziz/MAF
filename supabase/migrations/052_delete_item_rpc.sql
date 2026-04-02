CREATE OR REPLACE FUNCTION delete_item_safe(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM items WHERE id = p_item_id;
  RETURN '{"ok": true}'::jsonb;
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = '23503' THEN
    RETURN '{"ok": false, "error": "لا يمكن مسح الصنف لارتباطه بحركات أو جداول أخرى."}'::jsonb;
  END IF;
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION delete_item_group_safe(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete all items that belong to this group or its sub-groups
  DELETE FROM items WHERE item_group_id = p_group_id OR item_group_id IN (SELECT id FROM item_groups WHERE parent_group_id = p_group_id);
  
  -- Delete sub-groups
  DELETE FROM item_groups WHERE parent_group_id = p_group_id;
  
  -- Delete the group itself
  DELETE FROM item_groups WHERE id = p_group_id;
  
  RETURN '{"ok": true}'::jsonb;
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = '23503' THEN
    RETURN '{"ok": false, "error": "لا يمكن مسح المجموعة لأن أحد أصنافها أو مجموعاتها الفرعية مرتبط بحركات أو جداول أخرى مثل المشتريات."}'::jsonb;
  END IF;
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
