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
  Calendar,
  Clock,
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
type TaskDialogMode = "new" | "edit";

interface TaskDialogProps {
  mode: TaskDialogMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: string;
  setStatus: SetState<string>;
  title: string;
  setTitle: SetState<string>;
  description: string;
  setDescription: SetState<string>;
  priority: string;
  setPriority: SetState<string>;
  assignees: number[];
  setAssignees: SetState<number[]>;
  startDate: string;
  setStartDate: SetState<string>;
  endDate: string;
  setEndDate: SetState<string>;
  estimateHours: number;
  setEstimateHours: SetState<number>;
  estimateMinutes: number;
  setEstimateMinutes: SetState<number>;
  checklist: ChecklistItem[];
  newChecklistItem: string;
  setNewChecklistItem: SetState<string>;
  attachments: Attachment[];
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
  onSubmit: () => void;
  isSubmitting: boolean;
}

const getFileIcon = (type: string) => {
  if (type.startsWith("image/")) return <Image className="h-4 w-4" />;
  if (type.includes("pdf") || type.includes("document"))
    return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high": return "bg-rose-500 hover:bg-rose-600";
    case "medium": return "bg-amber-500 hover:bg-amber-600";
    case "low": return "bg-emerald-500 hover:bg-emerald-600";
    default: return "bg-slate-500";
  }
};

export function TaskDialog({
  mode,
  open,
  onOpenChange,
  status,
  setStatus,
  title,
  setTitle,
  description,
  setDescription,
  priority,
  setPriority,
  assignees,
  setAssignees,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  estimateHours,
  setEstimateHours,
  estimateMinutes,
  setEstimateMinutes,
  checklist,
  newChecklistItem,
  setNewChecklistItem,
  attachments,
  users,
  toggleAssignee,
  onToggleChecklistItem,
  onRemoveChecklistItem,
  onAddChecklistItem,
  onRemoveAttachment,
  onFileUpload,
  isUploading,
  onSubmit,
  isSubmitting,
}: TaskDialogProps) {
  const dialogLabel = mode === "edit" ? "Update Task" : "Create New Task";
  const submitLabel = mode === "edit" ? "Save Changes" : "Add Task";
  const fieldPrefix = mode === "edit" ? "edit-task" : "task";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] p-0 flex flex-col h-[90vh] md:h-[85vh] overflow-hidden rounded-2xl border-none shadow-2xl bg-white dark:bg-slate-950">

        {/* 1. FIXED HEADER */}
        <DialogHeader className="p-4 md:p-6 border-b shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{dialogLabel}</span>
            </div>
          </div>
          <Input
            className="text-xl md:text-2xl font-bold bg-transparent border-none p-0 focus-visible:ring-0 shadow-none h-auto placeholder:opacity-20"
            placeholder="Task title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid={`input-${fieldPrefix}-title`}
          />
        </DialogHeader>

        {/* 2. SCROLLABLE BODY */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 space-y-6 md:space-y-8">

            {/* ROW 1: STATUS, ASSIGNEES, & PRIORITY */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-900 border-none h-10 rounded-lg">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Assign Members</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-10 bg-slate-50 dark:bg-slate-900 border-none rounded-lg font-normal">
                      <span className="truncate">{assignees.length === 0 ? "Search members..." : `${assignees.length} Selected`}</span>
                      <Users className="h-4 w-4 opacity-40" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0 shadow-xl border-slate-200 dark:border-slate-800" align="start">
                    <div className="p-2 border-b bg-slate-50 dark:bg-slate-900">
                      <Input
                        placeholder="Search by name..."
                        className="h-8 text-xs border-none bg-white dark:bg-slate-800"
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase();
                          document.querySelectorAll('.user-search-item').forEach((item: any) => {
                            item.style.display = item.innerText.toLowerCase().includes(val) ? 'flex' : 'none';
                          });
                        }}
                      />
                    </div>
                    <ScrollArea className="h-48 p-2 bg-white dark:bg-slate-950">
                      {users.map((user) => (
                        <div key={user.id} className="user-search-item flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-md cursor-pointer transition-colors"
                          onClick={() => toggleAssignee(user.id, assignees, setAssignees)}>
                          <Checkbox checked={assignees.includes(user.id)} />
                          <span className="text-sm">{user.name}</span>
                        </div>
                      ))}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Priority</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className={`w-full border-none h-10 rounded-lg text-white font-medium transition-colors ${getPriorityColor(priority)}`}>
                    <SelectValue placeholder="Select Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ROW 2: DATES & ESTIMATES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3 w-3" /> Start Date
                  </label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 bg-slate-50 dark:bg-slate-900 border-none rounded-lg text-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3" /> End Date
                  </label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 bg-slate-50 dark:bg-slate-900 border-none rounded-lg text-sm" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Allocation (Hrs/Min)</label>
                <div className="flex items-center gap-2">
                  <Input type="number" placeholder="Hr" value={estimateHours || ""} onChange={(e) => setEstimateHours(Number(e.target.value) || 0)} className="h-10 bg-slate-50 dark:bg-slate-900 border-none rounded-lg text-center" />
                  <span className="text-xs font-bold opacity-30">H</span>
                  <Input type="number" placeholder="Min" value={estimateMinutes || ""} onChange={(e) => setEstimateMinutes(Number(e.target.value) || 0)} className="h-10 bg-slate-50 dark:bg-slate-900 border-none rounded-lg text-center" />
                  <span className="text-xs font-bold opacity-30">M</span>
                </div>
              </div>
            </div>

            {/* DESCRIPTION & CHECKLIST */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 opacity-50" /> Task Description
                </label>
                <Textarea
                  placeholder="Enter detailed notes..."
                  className="min-h-[120px] bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 resize-none rounded-xl text-sm focus-visible:ring-primary"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <ListChecks className="h-4 w-4 opacity-50" /> Checklist
                </label>
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl group transition-all hover:bg-slate-100">
                      <Checkbox checked={item.completed} onCheckedChange={() => onToggleChecklistItem(item.id)} />
                      <span className={`text-sm flex-1 ${item.completed ? "line-through text-muted-foreground" : "text-slate-700 dark:text-slate-200"}`}>{item.title}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10" onClick={() => onRemoveChecklistItem(item.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-2 bg-white dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 focus-within:ring-1 focus-within:ring-primary">
                    <Plus className="h-4 w-4 text-primary" />
                    <Input
                      placeholder="Add item to checklist..."
                      className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0 text-sm p-0 w-full"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && onAddChecklistItem()}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ATTACHMENTS */}
            <div className="space-y-4 pb-6">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Paperclip className="h-4 w-4 opacity-50" /> Resources & Files
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm group">
                    <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500">
                      {getFileIcon(att.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button
                        className="text-[11px] font-bold truncate block w-full text-slate-700 dark:text-slate-200 text-left hover:underline"
                        onClick={() => downloadAttachment(att.url, att.name)}
                      >
                        {att.name}
                      </button>
                      <p className="text-[9px] text-muted-foreground uppercase">{(att.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => onRemoveAttachment(att.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-primary/50 cursor-pointer transition-all group min-h-[80px]">
                  <input type="file" className="hidden" onChange={onFileUpload} disabled={isUploading} />
                  <div className="flex items-center gap-2">
                    <Upload className={`h-4 w-4 ${isUploading ? "animate-bounce" : "text-slate-400 group-hover:text-primary"}`} />
                    <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700">
                      {isUploading ? "Uploading..." : "Add File"}
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* 3. FIXED FOOTER */}
        <DialogFooter className="p-4 md:p-6 border-t bg-white dark:bg-slate-900 shrink-0">
          <div className="flex w-full gap-3">
            <DialogClose asChild>
              <Button variant="ghost" className="flex-1 rounded-xl">Cancel</Button>
            </DialogClose>
            <Button
              className="flex-[2] rounded-xl font-bold shadow-lg shadow-primary/20 bg-primary hover:brightness-110 transition-all"
              onClick={onSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Processing..." : submitLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}