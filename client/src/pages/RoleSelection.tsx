import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function RoleSelection() {
  const [, setLocation] = useLocation();
  const { user, selectRole, isLoading } = useAuth();
  const { toast } = useToast();

  const handleSelectRole = async (role: 'coach' | 'client') => {
    try {
      await selectRole(role);

      toast({
        title: 'Success',
        description: `You are now registered as a ${role}`,
      });

      // 導向對應的儀表板
      if (role === 'coach') {
        setLocation('/coach-dashboard');
      } else {
        setLocation('/client-dashboard');
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Failed to select role. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Welcome, {user?.firstName}!</h1>
          <p className="text-muted-foreground">
            Please select your role to get started
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={() => handleSelectRole('coach')}
            disabled={isLoading}
            className="w-full h-16 text-lg"
          >
            {isLoading ? 'Selecting...' : 'I\'m a Coach'}
          </Button>
          
          <Button
            onClick={() => handleSelectRole('client')}
            disabled={isLoading}
            variant="outline"
            className="w-full h-16 text-lg"
          >
            {isLoading ? 'Selecting...' : 'I\'m a Client'}
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          You can always change this later in your profile settings.
        </div>
      </div>
    </div>
  );
}

