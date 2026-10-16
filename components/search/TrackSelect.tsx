"use client";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TRACKS } from "@/config/apply";
import { UseFormReturn } from "react-hook-form";

interface TrackSelectProps {
  form: UseFormReturn<any>;
}

export const TrackSelect = ({ form }: TrackSelectProps) => {
  return (
    <FormField
      control={form.control}
      name="applicationType"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-medium text-muted-foreground">
            Application Type
          </FormLabel>
          <FormControl>
            <Select
              {...field}
              onValueChange={field.onChange}
              defaultValue="all"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {TRACKS.map((track) => (
                  <SelectItem key={track.id} value={track.id}>
                    {track.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
        </FormItem>
      )}
    />
  );
};
