import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAvatar(id: string | undefined) {
  return useQuery({
    queryKey: ["avatar", id],
    enabled: !!id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_avatars", { _ids: [id!] });
      return (data?.[0]?.avatar as string | undefined) ?? null;
    },
  }).data ?? null;
}

/** Shrink a picked photo to a small square JPEG (data URL) so it loads instantly everywhere. */
export async function photoToAvatar(file: File, size = 192): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.82);
}
