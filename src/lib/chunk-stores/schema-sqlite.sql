drop table if exists chunk;
create table chunk (x integer, y integer, z integer, voxels blob, updated_ms bigint(20));

create unique index chunk_id on chunk (x, y, z);


drop table if exists history;
create table history (world_id integer, created_ms bigint(20), x integer, y integer, z integer, voxels blob);

create unique index worldId_created_chunk on history (worldId, created_ms, x, y, z);


drop table if exists chat;

create table chat (id integer auto_increment, created_ms bigint(20), username varchar(255), message varchar(255), primary key (id));
