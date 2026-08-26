-- Migration 017: Vehicle and booking RLS policies

-- Vehicles RLS Policies
CREATE POLICY "Transporters can manage own vehicles"
    ON public.vehicles FOR ALL
    USING (
      transporter_id IN (
        SELECT tp.id FROM public.transporter_profiles tp
        JOIN public.user_profiles up ON up.id = tp.user_profile_id
        WHERE up.user_id = auth.uid()
      )
    )
    WITH CHECK (
      transporter_id IN (
        SELECT tp.id FROM public.transporter_profiles tp
        JOIN public.user_profiles up ON up.id = tp.user_profile_id
        WHERE up.user_id = auth.uid()
      )
    );

CREATE POLICY "Public can view active vehicles"
    ON public.vehicles FOR SELECT
    USING (status = 'active' AND deleted_at IS NULL);

-- Vehicle Availability RLS Policies
CREATE POLICY "Transporters can manage own vehicle availability"
    ON public.vehicle_availability FOR ALL
    USING (
      vehicle_id IN (
        SELECT v.id FROM public.vehicles v
        JOIN public.transporter_profiles tp ON tp.id = v.transporter_id
        JOIN public.user_profiles up ON up.id = tp.user_profile_id
        WHERE up.user_id = auth.uid()
      )
    )
    WITH CHECK (
      vehicle_id IN (
        SELECT v.id FROM public.vehicles v
        JOIN public.transporter_profiles tp ON tp.id = v.transporter_id
        JOIN public.user_profiles up ON up.id = tp.user_profile_id
        WHERE up.user_id = auth.uid()
      )
    );

CREATE POLICY "Public can view vehicle availability"
    ON public.vehicle_availability FOR SELECT
    USING (true);

-- Transport Bookings RLS Policies
CREATE POLICY "Transporters can view and update their bookings"
    ON public.transport_bookings FOR ALL
    USING (
      transporter_id IN (
        SELECT tp.id FROM public.transporter_profiles tp
        JOIN public.user_profiles up ON up.id = tp.user_profile_id
        WHERE up.user_id = auth.uid()
      )
    )
    WITH CHECK (
      transporter_id IN (
        SELECT tp.id FROM public.transporter_profiles tp
        JOIN public.user_profiles up ON up.id = tp.user_profile_id
        WHERE up.user_id = auth.uid()
      )
    );

CREATE POLICY "Organizers can create and view their transport bookings"
    ON public.transport_bookings FOR ALL
    USING (
      organizer_id IN (
        SELECT op.id FROM public.organizer_profiles op
        JOIN public.user_profiles up ON up.id = op.user_profile_id
        WHERE up.user_id = auth.uid()
      )
    )
    WITH CHECK (
      organizer_id IN (
        SELECT op.id FROM public.organizer_profiles op
        JOIN public.user_profiles up ON up.id = op.user_profile_id
        WHERE up.user_id = auth.uid()
      )
    );
