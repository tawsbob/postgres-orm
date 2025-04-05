  expect(steps[0].objectType).toBe('policy');
  expect(steps[0].name).toBe('policy_User_user_policy');
  expect(steps[0].sql).toContain('CREATE POLICY');
  expect(steps[0].sql).toContain('WITH CHECK ((role = \'USER\'))');
  expect(steps[0].rollbackSql).toContain('DROP POLICY'); 