import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatTimeLabel(value: string): string {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function buildTimeOptions(min?: string): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  return min ? options.filter((t) => t >= min) : options;
}

// A dropdown replacement for <input type="time">, built from Select instead
// of the browser's native time picker. A native time input's own popover
// lives outside the React tree, which fights a Radix Dialog's focus trap
// (the dialog sees focus "leave" and yanks it back, closing the native
// picker a moment after it opens - most visible on Safari). Keeping the
// whole picker inside React sidesteps that entirely.
export function TimeSelect({
  value,
  onChange,
  min,
  "data-testid": testId,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  "data-testid"?: string;
}) {
  const options = buildTimeOptions(min);
  const allOptions = value && !options.includes(value) ? [...options, value].sort() : options;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid={testId}>
        <SelectValue placeholder="Select time" />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {allOptions.map((t) => (
          <SelectItem key={t} value={t}>
            {formatTimeLabel(t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
