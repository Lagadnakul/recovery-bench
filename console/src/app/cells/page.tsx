import { Cells } from "@/components/screens/Cells";
import { loadProvenance } from "@/model/rows";

/**
 * The only screen whose data is fetched in the browser rather than resolved at
 * build time, because it is the only one where the reader -- not the author --
 * decides which rows matter. See `src/model/cells.ts` for why that file is
 * served from public/ rather than inlined.
 */
export default function Page() {
  // The snapshot's own figures, so the heading is correct before the fetch
  // resolves and the error state can say what it was trying to read.
  const provenance = loadProvenance();
  return (
    <Cells snapshot={{ rows: provenance.rows, commit: provenance.commit }} />
  );
}
