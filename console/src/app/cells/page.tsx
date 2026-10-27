import { Cells } from "@/components/screens/Cells";

/**
 * The only screen whose data is fetched in the browser rather than resolved at
 * build time, because it is the only one where the reader -- not the author --
 * decides which rows matter. See `src/model/cells.ts` for why that file is
 * served from public/ rather than inlined.
 */
export default function Page() {
  return <Cells />;
}
