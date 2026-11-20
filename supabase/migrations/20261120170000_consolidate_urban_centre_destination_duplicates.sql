update public.destinations set county='Tana River/Garissa' where id='b44e663b-b197-4ef2-be83-bd8d61f9c476';
update public.destinations set county='Nairobi City' where id='aea4d4b9-6bcf-4b8f-a922-051cc48d24c4';
update public.destinations set county='Nyeri/Laikipia' where id='c88eb7fc-08b5-465a-a510-3f42a582cb40';
update public.destinations set county='Murang''a/Kiambu' where id='c8bc2826-be99-48d2-92ee-81c8078011a5';
update public.destinations d
set destination_type='urban_centre',population_2019=u.population_2019,sort_order=u.population_rank
from public.kenya_urban_centres u
where lower(d.city)=lower(u.name) and lower(d.county)=lower(u.county_name)
and d.id in (
'b44e663b-b197-4ef2-be83-bd8d61f9c476',
'aea4d4b9-6bcf-4b8f-a922-051cc48d24c4',
'c88eb7fc-08b5-465a-a510-3f42a582cb40',
'c8bc2826-be99-48d2-92ee-81c8078011a5'
);
delete from public.destinations where id in (
'f64df54d-b1b7-4bda-8ec7-a1a38ba7fa59',
'a38b2ce7-e3ef-4a59-a345-0b570eb77c27',
'ba32fdd9-42ba-49e1-ab08-f2c007335025',
'608d57cf-c94e-419d-95b3-5bc51533d1ab'
);