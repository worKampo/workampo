-- ticket: #90
-- Reference data: the same binding name in every environment, so one row serves all of them.
INSERT INTO `shards` (`id`, `engine`, `binding_name`, `created_at`)
VALUES ('shard-1', 'd1', 'DB_SHARD_1', '2026-11-24T00:00:00.000Z')
ON CONFLICT DO NOTHING;
