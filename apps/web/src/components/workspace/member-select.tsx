"use client";

import { useQuery } from "@/lib/query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { membersQuery } from "@/lib/api/organizations";

export const NONE = "__none__";

/** Picks a member of the organization; value "" means nobody. */
export function MemberSelect({
  organizationId,
  value,
  onChange,
  id,
  placeholder = "Nobody",
  noneLabel = "Nobody",
  className,
  disabled,
  ...aria
}: {
  organizationId: string;
  value: string;
  onChange: (userId: string) => void;
  id?: string;
  placeholder?: string;
  noneLabel?: string;
  className?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  const { data: members } = useQuery(membersQuery(organizationId));

  return (
    <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? "" : next)} disabled={disabled}>
      <SelectTrigger id={id} className={className ?? "w-full"} {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {members?.map((member) => (
          <SelectItem key={member.userId} value={member.userId}>
            {member.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
