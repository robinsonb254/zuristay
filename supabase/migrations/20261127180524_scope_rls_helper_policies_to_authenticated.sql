-- Keep SECURITY DEFINER ownership/admin helpers private to authenticated sessions.
REVOKE EXECUTE ON FUNCTION public.owns_property(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;

-- Admin write policies must never be evaluated for anonymous visitors.
ALTER POLICY "Admins manage amenities" ON public.amenities TO authenticated;
ALTER POLICY "Admins manage booking items" ON public.booking_items TO authenticated;
ALTER POLICY "Admins manage bookings" ON public.bookings TO authenticated;
ALTER POLICY "Admins manage commission rules" ON public.commission_rules TO authenticated;
ALTER POLICY "Admins manage destinations" ON public.destinations TO authenticated;
ALTER POLICY "Admins manage applications" ON public.partner_applications TO authenticated;
ALTER POLICY "Admins manage settlements" ON public.partner_settlements TO authenticated;
ALTER POLICY "Admins manage payments" ON public.payments TO authenticated;
ALTER POLICY "Admins can manage profiles" ON public.profiles TO authenticated;
ALTER POLICY "Admins manage partners" ON public.property_partners TO authenticated;

-- Private customer/partner data is visible only to authenticated accounts.
ALTER POLICY "Customers view their booking items" ON public.booking_items TO authenticated;
ALTER POLICY "Customers view their own bookings" ON public.bookings TO authenticated;
ALTER POLICY "Applicants view their own applications" ON public.partner_applications TO authenticated;
ALTER POLICY "Partners view their settlements" ON public.partner_settlements TO authenticated;
ALTER POLICY "Customers view their own payments" ON public.payments TO authenticated;
ALTER POLICY "Users can view their own profile" ON public.profiles TO authenticated;
ALTER POLICY "Partners view their own business" ON public.property_partners TO authenticated;

-- Keep active public destination and commission-rule reads without helper calls.
DROP POLICY "Public can view active commission rules" ON public.commission_rules;
CREATE POLICY "Public can view active commission rules" ON public.commission_rules
  FOR SELECT TO anon USING (active = true);
CREATE POLICY "Authenticated can view active commission rules" ON public.commission_rules
  FOR SELECT TO authenticated USING (active = true OR is_admin());

DROP POLICY "Public can view active destinations" ON public.destinations;
CREATE POLICY "Public can view active destinations" ON public.destinations
  FOR SELECT TO anon USING (active = true);
CREATE POLICY "Authenticated can view active destinations" ON public.destinations
  FOR SELECT TO authenticated USING (active = true OR is_admin());

-- Public approved listings are visible to guests; draft/owned records stay private.
ALTER POLICY "Partners manage their properties" ON public.properties TO authenticated;
DROP POLICY "Public can view approved properties" ON public.properties;
CREATE POLICY "Public can view approved properties" ON public.properties
  FOR SELECT TO anon USING (status = 'approved' AND is_active = true);
CREATE POLICY "Authenticated can view approved and managed properties" ON public.properties
  FOR SELECT TO authenticated USING (
    (status = 'approved' AND is_active = true) OR owns_property(id) OR is_admin()
  );

ALTER POLICY "Partners manage their units" ON public.property_units TO authenticated;
DROP POLICY "Public can view units of approved properties" ON public.property_units;
CREATE POLICY "Public can view units of approved properties" ON public.property_units
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.properties p
      WHERE p.id = property_units.property_id AND p.status = 'approved' AND p.is_active = true)
  );
CREATE POLICY "Authenticated can view approved and managed units" ON public.property_units
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.properties p
      WHERE p.id = property_units.property_id AND p.status = 'approved' AND p.is_active = true)
    OR owns_property(property_id) OR is_admin()
  );

ALTER POLICY "Partners manage property images" ON public.property_images TO authenticated;
DROP POLICY "Public can view approved property images" ON public.property_images;
CREATE POLICY "Public can view approved property images" ON public.property_images
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.properties p
      WHERE p.id = property_images.property_id AND p.status = 'approved' AND p.is_active = true)
  );
CREATE POLICY "Authenticated can view approved and managed images" ON public.property_images
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.properties p
      WHERE p.id = property_images.property_id AND p.status = 'approved' AND p.is_active = true)
    OR owns_property(property_id) OR is_admin()
  );

ALTER POLICY "Partners manage property amenities" ON public.property_amenities TO authenticated;
DROP POLICY "Public can view property amenities" ON public.property_amenities;
CREATE POLICY "Public can view property amenities" ON public.property_amenities
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.properties p
      WHERE p.id = property_amenities.property_id AND p.status = 'approved' AND p.is_active = true)
  );
CREATE POLICY "Authenticated can view approved and managed property amenities" ON public.property_amenities
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.properties p
      WHERE p.id = property_amenities.property_id AND p.status = 'approved' AND p.is_active = true)
    OR owns_property(property_id) OR is_admin()
  );

ALTER POLICY "Partners manage unit availability" ON public.unit_availability TO authenticated;
DROP POLICY "Public can view approved unit availability" ON public.unit_availability;
CREATE POLICY "Public can view approved unit availability" ON public.unit_availability
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.property_units u
      JOIN public.properties p ON p.id = u.property_id
      WHERE u.id = unit_availability.unit_id AND p.status = 'approved' AND p.is_active = true)
  );
CREATE POLICY "Authenticated can view approved and managed availability" ON public.unit_availability
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.property_units u
      JOIN public.properties p ON p.id = u.property_id
      WHERE u.id = unit_availability.unit_id AND p.status = 'approved' AND p.is_active = true)
    OR EXISTS (SELECT 1 FROM public.property_units u
      WHERE u.id = unit_availability.unit_id AND owns_property(u.property_id))
    OR is_admin()
  );
