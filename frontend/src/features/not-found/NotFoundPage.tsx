import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/ui/Feedback';
import { buttonStyles } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="card">
      <EmptyState
        icon={<Compass className="h-5 w-5" aria-hidden="true" />}
        title="Page not found"
        description="The page you requested does not exist in this ClaimFlow deployment. Return to the overview to continue."
        action={
          <Link to="/" className={buttonStyles({ size: 'sm' })}>
            Back to overview
          </Link>
        }
      />
    </div>
  );
}
