import { Badge } from '@/components/ui/Badge';
import { ROLE_DEFINITIONS, type RolesState } from '@/lib/roles';
import { cn } from '@/lib/cn';

const ROLE_KEYS = {
  operator: 'isOperator',
  approver: 'isApprover',
  settler: 'isSettler',
  canceller: 'isCanceller',
  admin: 'isAdmin',
} as const;

export function RoleBadges({
  roles,
  className,
  showDescription = false,
}: {
  roles: RolesState;
  className?: string;
  showDescription?: boolean;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {ROLE_DEFINITIONS.map((definition) => {
        const hasRole = Boolean(roles[ROLE_KEYS[definition.key]]);
        return (
          <Badge
            key={definition.key}
            tone={hasRole ? 'primary' : 'neutral'}
            title={showDescription ? definition.description : undefined}
            className={cn(!hasRole && 'opacity-70')}
          >
            <span
              className={cn('h-1.5 w-1.5 rounded-full', hasRole ? 'bg-primary' : 'bg-ink-muted')}
              aria-hidden="true"
            />
            {definition.label}
            {hasRole ? (
              <span className="sr-only"> granted</span>
            ) : (
              <span className="sr-only"> not granted</span>
            )}
          </Badge>
        );
      })}
    </div>
  );
}
