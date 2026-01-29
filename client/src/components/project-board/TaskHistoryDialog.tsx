import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Clock, History, User as UserIcon } from "lucide-react";
import type { HistoryEntry, Task } from "@shared/schema";

interface TaskHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  historyTask: Task | null;
}

export function TaskHistoryDialog({
  open,
  onOpenChange,
  historyTask,
}: TaskHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Task History
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 py-4">
            {historyTask?.history && historyTask.history.length > 0 ? (
              [...historyTask.history].reverse().map((entry, index) => {
                const isStructured =
                  typeof entry === "object" && entry !== null && "action" in entry;
                const historyEntry = isStructured
                  ? (entry as HistoryEntry)
                  : null;
                const legacyEntry = !isStructured ? String(entry) : null;

                return (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="h-2 w-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {historyEntry ? (
                        <>
                          <p className="text-sm font-medium">
                            {historyEntry.action}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <UserIcon className="h-3 w-3" />
                              {historyEntry.userName || "Unknown"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(
                                historyEntry.timestamp,
                              ).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(
                                historyEntry.timestamp,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm">{legacyEntry}</p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                No history available
              </p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
