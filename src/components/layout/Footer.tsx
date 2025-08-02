import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const handleDocumentationClick = () => {
    window.open('https://github.com/dhiway/dedi-publish', '_blank');
  };

  const handleFeedbackClick = () => {
    window.open('https://github.com/dedi-official/community/issues', '_blank');
  };

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 py-6 mt-auto border-t border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {currentYear} DeDi. All rights reserved.
          </p>
          
          <div className="flex gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDocumentationClick}
              className="flex items-center gap-2"
            >
              Documentation
              <ExternalLink className="h-3 w-3" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleFeedbackClick}
              className="flex items-center gap-2"
            >
              Feedback
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
