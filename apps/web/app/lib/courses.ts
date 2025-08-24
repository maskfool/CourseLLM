// app/lib/courses.ts
export type Course = { id: string; label: string };

export const COURSES: Course[] = [
  { id: "all", label: "All Courses" },
  { id: "nodejs", label: "Node.js" },
  { id: "python", label: "Python" },
  // add more here as you ingest: { id: "react", label: "React" }, ...
];

export function courseLabel(id?: string | null) {
  const found = COURSES.find(c => c.id === (id || "all"));
  return found?.label || "All Courses";
}