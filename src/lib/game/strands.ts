import type { SubjectSlug } from "./subjects";

/** Each subject's strands, in display order. Topic rows name their strand. */
export const STRANDS_BY_SUBJECT: Record<SubjectSlug, readonly { slug: string; name: string }[]> = {
  maths: [
    { slug: "number", name: "Number" },
    { slug: "algebra", name: "Algebra" },
    { slug: "ratio", name: "Ratio, proportion and rates of change" },
    { slug: "geometry", name: "Geometry and measures" },
    { slug: "probability", name: "Probability" },
    { slug: "statistics", name: "Statistics" },
  ],
  biology: [
    { slug: "cell-biology", name: "Cell biology" },
    { slug: "organisation", name: "Organisation" },
    { slug: "infection", name: "Infection and response" },
    { slug: "bioenergetics", name: "Bioenergetics" },
    { slug: "homeostasis", name: "Homeostasis and response" },
    { slug: "inheritance", name: "Inheritance, variation and evolution" },
    { slug: "ecology", name: "Ecology" },
  ],
};

export const STRANDS = STRANDS_BY_SUBJECT.maths;
