-- Add property_id to events table for property-specific visit tracking
ALTER TABLE public.events ADD COLUMN property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_events_property_id ON public.events(property_id);