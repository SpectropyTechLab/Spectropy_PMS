import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, Users } from "lucide-react";
import type { User } from "@shared/schema";

type SetState<T> = Dispatch<SetStateAction<T>>;

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newTaskTitle: string;
  setNewTaskTitle: SetState<string>;
  newTaskDescription: string;
  setNewTaskDescription: SetState<string>;
  newTaskPriority: string;
  setNewTaskPriority: SetState<string>;
  newTaskAssignees: number[];
  setNewTaskAssignees: SetState<number[]>;
  newTaskStartDate: string;
  setNewTaskStartDate: SetState<string>;
  newTaskEndDate: string;
  setNewTaskEndDate: SetState<string>;
  newTaskEstimateHours: number;
  setNewTaskEstimateHours: SetState<number>;
  newTaskEstimateMinutes: number;
  setNewTaskEstimateMinutes: SetState<number>;
  users: User[];
  toggleAssignee: (
    userId: number,
    assignees: number[],
    setAssignees: SetState<number[]>,
  ) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function NewTaskDialog({
  open,
  onOpenChange,
  newTaskTitle,
  setNewTaskTitle,
  newTaskDescription,
  setNewTaskDescription,
  newTaskPriority,
  setNewTaskPriority,
  newTaskAssignees,
  setNewTaskAssignees,
  newTaskStartDate,
  setNewTaskStartDate,
  newTaskEndDate,
  setNewTaskEndDate,
  newTaskEstimateHours,
  setNewTaskEstimateHours,
  newTaskEstimateMinutes,
  setNewTaskEstimateMinutes,
  users,
  toggleAssignee,
  onSubmit,
  isSubmitting,
}: NewTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-scroll flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 flex-1 overflow-y-auto">
          <Input
            placeholder="Task title..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            data-testid="input-task-title"
          />
          <Textarea
            placeholder="Description (optional)..."
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            data-testid="input-task-description"
          />
          <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
            <SelectTrigger data-testid="select-task-priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              <Users className="h-4 w-4 inline mr-2" />
              Assign Users
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  data-testid="button-assign-users-new"
                >
                  <span className="truncate">
                    {newTaskAssignees.length === 0
                      ? "Select users..."
                      : `${newTaskAssignees.length} user${newTaskAssignees.length > 1 ? "s" : ""} selected`}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-1">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 p-2 rounded hover-elevate cursor-pointer"
                      onClick={() =>
                        toggleAssignee(
                          user.id,
                          newTaskAssignees,
                          setNewTaskAssignees,
                        )
                      }
                    >
                      <Checkbox
                        checked={newTaskAssignees.includes(user.id)}
                        onCheckedChange={() =>
                          toggleAssignee(
                            user.id,
                            newTaskAssignees,
                            setNewTaskAssignees,
                          )
                        }
                      />
                      <span className="text-sm">{user.name}</span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Start Date
              </label>
              <Input
                type="date"
                value={newTaskStartDate}
                onChange={(e) => setNewTaskStartDate(e.target.value)}
                data-testid="input-task-start-date"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                End Date
              </label>
              <Input
                type="date"
                value={newTaskEndDate}
                onChange={(e) => setNewTaskEndDate(e.target.value)}
                data-testid="input-task-end-date"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Time Estimate
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                placeholder="Hours"
                value={newTaskEstimateHours || ""}
                onChange={(e) =>
                  setNewTaskEstimateHours(Number(e.target.value) || 0)
                }
                className="w-24"
                data-testid="input-task-estimate-hours"
              />
              <span className="text-sm text-muted-foreground">h</span>
              <Input
                type="number"
                min="0"
                max="59"
                placeholder="Minutes"
                value={newTaskEstimateMinutes || ""}
                onChange={(e) =>
                  setNewTaskEstimateMinutes(Number(e.target.value) || 0)
                }
                className="w-24"
                data-testid="input-task-estimate-minutes"
              />
              <span className="text-sm text-muted-foreground">m</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting}
            data-testid="button-submit-task"
          >
            Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
