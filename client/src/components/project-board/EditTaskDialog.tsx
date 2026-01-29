import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  ChevronDown,
  File,
  FileText,
  Image,
  ListChecks,
  Paperclip,
  Plus,
  Upload,
  Users,
  X,
} from "lucide-react";
import { downloadAttachment } from "@/hooks/use-download";
import type { Attachment, ChecklistItem, User } from "@shared/schema";

type SetState<T> = Dispatch<SetStateAction<T>>;

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTaskStatus: string;
  setEditTaskStatus: SetState<string>;
  editTaskTitle: string;
  setEditTaskTitle: SetState<string>;
  editTaskDescription: string;
  setEditTaskDescription: SetState<string>;
  editTaskPriority: string;
  setEditTaskPriority: SetState<string>;
  editTaskAssignees: number[];
  setEditTaskAssignees: SetState<number[]>;
  editTaskStartDate: string;
  setEditTaskStartDate: SetState<string>;
  editTaskEndDate: string;
  setEditTaskEndDate: SetState<string>;
  editTaskEstimateHours: number;
  setEditTaskEstimateHours: SetState<number>;
  editTaskEstimateMinutes: number;
  setEditTaskEstimateMinutes: SetState<number>;
  editTaskChecklist: ChecklistItem[];
  newChecklistItem: string;
  setNewChecklistItem: SetState<string>;
  editTaskAttachments: Attachment[];
  users: User[];
  toggleAssignee: (
    userId: number,
    assignees: number[],
    setAssignees: SetState<number[]>,
  ) => void;
  onToggleChecklistItem: (itemId: string) => void;
  onRemoveChecklistItem: (itemId: string) => void;
  onAddChecklistItem: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  onSave: () => void;
  isSaving: boolean;
}

const getFileIcon = (type: string) => {
  if (type.startsWith("image/")) return <Image className="h-4 w-4" />;
  if (type.includes("pdf") || type.includes("document"))
    return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
};

export function EditTaskDialog({
  open,
  onOpenChange,
  editTaskStatus,
  setEditTaskStatus,
  editTaskTitle,
  setEditTaskTitle,
  editTaskDescription,
  setEditTaskDescription,
  editTaskPriority,
  setEditTaskPriority,
  editTaskAssignees,
  setEditTaskAssignees,
  editTaskStartDate,
  setEditTaskStartDate,
  editTaskEndDate,
  setEditTaskEndDate,
  editTaskEstimateHours,
  setEditTaskEstimateHours,
  editTaskEstimateMinutes,
  setEditTaskEstimateMinutes,
  editTaskChecklist,
  newChecklistItem,
  setNewChecklistItem,
  editTaskAttachments,
  users,
  toggleAssignee,
  onToggleChecklistItem,
  onRemoveChecklistItem,
  onAddChecklistItem,
  onRemoveAttachment,
  onFileUpload,
  isUploading,
  onSave,
  isSaving,
}: EditTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 max-h-[65vh] overflow-scroll">
          <div className="space-y-4 py-4 pr-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Status
              </label>
              <Select value={editTaskStatus} onValueChange={setEditTaskStatus}>
                <SelectTrigger data-testid="select-edit-task-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Input
              placeholder="Task title..."
              value={editTaskTitle}
              onChange={(e) => setEditTaskTitle(e.target.value)}
              data-testid="input-edit-task-title"
            />
            <Textarea
              placeholder="Description (optional)..."
              value={editTaskDescription}
              onChange={(e) => setEditTaskDescription(e.target.value)}
              data-testid="input-edit-task-description"
            />

            <Select value={editTaskPriority} onValueChange={setEditTaskPriority}>
              <SelectTrigger data-testid="select-edit-task-priority">
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
                    data-testid="button-assign-users-edit"
                  >
                    <span className="truncate">
                      {editTaskAssignees.length === 0
                        ? "Select users..."
                        : `${editTaskAssignees.length} user${editTaskAssignees.length > 1 ? "s" : ""} selected`}
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
                            editTaskAssignees,
                            setEditTaskAssignees,
                          )
                        }
                      >
                        <Checkbox
                          checked={editTaskAssignees.includes(user.id)}
                          onCheckedChange={() =>
                            toggleAssignee(
                              user.id,
                              editTaskAssignees,
                              setEditTaskAssignees,
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
                  value={editTaskStartDate}
                  onChange={(e) => setEditTaskStartDate(e.target.value)}
                  data-testid="input-edit-task-start-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  End Date
                </label>
                <Input
                  type="date"
                  value={editTaskEndDate}
                  onChange={(e) => setEditTaskEndDate(e.target.value)}
                  data-testid="input-edit-task-end-date"
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
                  value={editTaskEstimateHours || ""}
                  onChange={(e) =>
                    setEditTaskEstimateHours(Number(e.target.value) || 0)
                  }
                  className="w-24"
                  data-testid="input-edit-task-estimate-hours"
                />
                <span className="text-sm text-muted-foreground">h</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="Minutes"
                  value={editTaskEstimateMinutes || ""}
                  onChange={(e) =>
                    setEditTaskEstimateMinutes(Number(e.target.value) || 0)
                  }
                  className="w-24"
                  data-testid="input-edit-task-estimate-minutes"
                />
                <span className="text-sm text-muted-foreground">m</span>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <label className="text-sm font-medium mb-2 flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Checklist
              </label>
              <div className="space-y-2 mt-2">
                {editTaskChecklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => onToggleChecklistItem(item.id)}
                    />
                    <span
                      className={`flex-1 text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}
                    >
                      {item.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onRemoveChecklistItem(item.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    placeholder="Add checklist item..."
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onAddChecklistItem()}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddChecklistItem}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <label className="text-sm font-medium mb-2 flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments
              </label>
              <div className="space-y-2 mt-2">
                {editTaskAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 p-2 bg-muted rounded"
                  >
                    {getFileIcon(att.type)}
                    <button
                      className="flex-1 text-sm truncate text-left text-indigo-500 hover:underline"
                      onClick={() => downloadAttachment(att.url, att.name)}
                    >
                      {att.name}
                    </button>

                    <span className="text-xs text-muted-foreground">
                      {(att.size / 1024).toFixed(1)}KB
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onRemoveAttachment(att.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="mt-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      onChange={onFileUpload}
                      disabled={isUploading}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isUploading}
                      asChild
                    >
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploading ? "Uploading..." : "Upload File"}
                      </span>
                    </Button>
                  </label>
                  <span className="text-xs text-muted-foreground ml-2">
                    Max 10MB
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={onSave}
            disabled={isSaving}
            data-testid="button-save-edit-task"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
