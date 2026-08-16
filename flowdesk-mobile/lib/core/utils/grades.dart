int percentage(int marks, int max) => max > 0 ? ((marks / max) * 100).round() : 0;

String gradeFor(int pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C+';
  if (pct >= 40) return 'C';
  return 'D';
}
