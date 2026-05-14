// Stable composite key per pick "this driver in this series".
// Bonus pools can share numbers with Cup drivers (e.g. #7 Heim runs Cup AND
// Truck), so we can't dedupe by num alone — series + num together are unique.
export const pickKey = (series, num) => `${series}:${num}`;
