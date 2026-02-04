import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import {
    Calendar as CalendarIcon,
    Trash2,
    User as UserIcon,
    Layout,
    Clock,
    Save
} from "lucide-react";

// UI Components
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

// Types
import type { Task, Bucket, User } from "@shared/schema";
import { cn } from "@/lib/utils";

// --- Form Schema ---
const taskFormSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    status: z.enum(["todo", "in_progress", "completed"]),
    priority: z.enum(["low", "medium", "high"]),
    bucketId: z.number().nullable(),
    assigneeId: z.number().nullable(),
    dueDate: z.date().nullable().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskDialogProps {
    mode: "create" | "edit";
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: number;
    selectedBucketId: number | null;
    task: Task | null;
    buckets: Bucket[];
    users: User[];
    tasks?: Task[];
    canCreateTask?: boolean;
    canUpdateTask?: boolean;
    canCompleteTask?: boolean;
    onAfterClose?: () => void;
}

const TaskDialog = ({
    mode,
    open,
    onOpenChange,
    projectId,
    selectedBucketId,
    task,
    buckets,
    users,
    canCreateTask = true,
    canUpdateTask = true,
    onAfterClose,
}: TaskDialogProps) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // 1. Setup Form
    const form = useForm<TaskFormValues>({
        resolver: zodResolver(taskFormSchema),
        defaultValues: {
            title: "",
            description: "",
            status: "todo",
            priority: "medium",
            bucketId: selectedBucketId,
            assigneeId: null,
            dueDate: null,
        },
    });

    // 2. Sync Form with Task Prop
    useEffect(() => {
        if (task && open) {
            form.reset({
                title: task.title,
                description: task.description || "",
                status: (task.status as "todo" | "in_progress" | "completed") || "todo",
                priority: (task.priority as "low" | "medium" | "high") || "medium",
                bucketId: task.bucketId,
                assigneeId: task.assigneeId,
                dueDate: task.dueDate ? new Date(task.dueDate) : null,
            });
        } else if (mode === "create" && open) {
            form.reset({
                title: "",
                description: "",
                status: "todo",
                priority: "medium",
                bucketId: selectedBucketId,
                assigneeId: null,
                dueDate: null,
            });
        }
    }, [task, open, mode, selectedBucketId, form]);

    // 3. Mutations
    const createMutation = useMutation({
        mutationFn: async (values: TaskFormValues) => {
            const res = await apiRequest("POST", "/api/tasks", {
                ...values,
                projectId,
            });
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Task created", description: "New task has been added." });
            queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
            onOpenChange(false);
            onAfterClose?.();
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (values: TaskFormValues) => {
            if (!task) throw new Error("No task selected");
            const res = await apiRequest("PATCH", `/api/tasks/${task.id}`, values);
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Task updated", description: "Changes saved successfully." });
            queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
            onOpenChange(false);
            onAfterClose?.();
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!task) return;
            await apiRequest("DELETE", `/api/tasks/${task.id}`);
        },
        onSuccess: () => {
            toast({ title: "Task deleted", description: "Task has been removed." });
            queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
            onOpenChange(false);
            onAfterClose?.();
        },
    });

    const onSubmit = (values: TaskFormValues) => {
        if (mode === "create") {
            createMutation.mutate(values);
        } else {
            updateMutation.mutate(values);
        }
    };

    const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
    const isReadOnly = (mode === "edit" && !canUpdateTask) || (mode === "create" && !canCreateTask);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden bg-slate-50/50">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-[85vh] md:h-auto">

                        {/* --- Header --- */}
                        <DialogHeader className="p-6 pb-4 bg-white border-b border-slate-100 flex-row items-start justify-between space-y-0">
                            <div className="flex-1 mr-8">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="text-xs font-normal text-slate-500 gap-1">
                                        <Layout className="w-3 h-3" />
                                        {/* FIX: Changed from b.name to b.title */}
                                        {buckets.find(b => b.id === form.watch('bucketId'))?.title || 'Backlog'}
                                    </Badge>
                                    {mode === "edit" && (
                                        <span className="text-xs text-slate-400">#{task?.id}</span>
                                    )}
                                </div>
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="Task Title"
                                                    className="text-xl font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0 placeholder:text-slate-300 bg-transparent"
                                                    disabled={isReadOnly}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </DialogHeader>

                        {/* --- Body (2 Columns) --- */}
                        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto">

                            {/* Left: Description & Activity */}
                            <div className="flex-1 p-6 bg-white space-y-6">
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-500 font-medium flex items-center gap-2">
                                                Description
                                            </FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    {...field}
                                                    placeholder="Add more details about this task..."
                                                    className="min-h-[200px] resize-none border-slate-200 bg-slate-50/50 focus:bg-white transition-colors"
                                                    disabled={isReadOnly}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Right: Metadata Sidebar */}
                            <div className="w-full md:w-80 border-l border-slate-100 bg-slate-50/50 p-6 space-y-6">

                                {/* Status */}
                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase text-slate-400">Status</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                disabled={isReadOnly}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="bg-white border-slate-200">
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="todo">
                                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-400" /> To Do</div>
                                                    </SelectItem>
                                                    <SelectItem value="in_progress">
                                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /> In Progress</div>
                                                    </SelectItem>
                                                    <SelectItem value="completed">
                                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Completed</div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                {/* Bucket */}
                                <FormField
                                    control={form.control}
                                    name="bucketId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase text-slate-400">Bucket</FormLabel>
                                            <Select
                                                onValueChange={(val) => field.onChange(Number(val))}
                                                value={field.value?.toString()}
                                                disabled={isReadOnly}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="bg-white border-slate-200">
                                                        <SelectValue placeholder="Select bucket" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {buckets.map((bucket) => (
                                                        <SelectItem key={bucket.id} value={bucket.id.toString()}>
                                                            {/* FIX: Changed from bucket.name to bucket.title */}
                                                            {bucket.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                <Separator className="bg-slate-200" />

                                {/* Priority */}
                                <FormField
                                    control={form.control}
                                    name="priority"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase text-slate-400">Priority</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                disabled={isReadOnly}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="bg-white border-slate-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="low">Low Priority</SelectItem>
                                                    <SelectItem value="medium">Medium Priority</SelectItem>
                                                    <SelectItem value="high">High Priority</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                {/* Assignee */}
                                <FormField
                                    control={form.control}
                                    name="assigneeId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase text-slate-400">Assignee</FormLabel>
                                            <Select
                                                onValueChange={(val) => field.onChange(val === "unassigned" ? null : Number(val))}
                                                value={field.value?.toString() || "unassigned"}
                                                disabled={isReadOnly}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="bg-white border-slate-200">
                                                        <div className="flex items-center gap-2">
                                                            <UserIcon className="w-4 h-4 text-slate-400" />
                                                            <SelectValue placeholder="Unassigned" />
                                                        </div>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                                    {users.map((user) => (
                                                        <SelectItem key={user.id} value={user.id.toString()}>
                                                            {user.username}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                {/* Due Date */}
                                <FormField
                                    control={form.control}
                                    name="dueDate"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel className="text-xs font-bold uppercase text-slate-400">Due Date</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                "pl-3 text-left font-normal bg-white border-slate-200",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                            disabled={isReadOnly}
                                                        >
                                                            {field.value ? (
                                                                format(field.value, "PPP")
                                                            ) : (
                                                                <span>Pick a date</span>
                                                            )}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value || undefined}
                                                        onSelect={field.onChange}
                                                        disabled={(date) => date < new Date("1900-01-01")}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* --- Footer --- */}
                        <DialogFooter className="p-4 bg-white border-t border-slate-100 flex items-center justify-between sm:justify-between w-full">
                            <div className="flex items-center">
                                {mode === "edit" && !isReadOnly && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => deleteMutation.mutate()}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                        disabled={isLoading}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Task
                                    </Button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                    Cancel
                                </Button>
                                {!isReadOnly && (
                                    <Button type="submit" disabled={isLoading} className="bg-primary text-primary-foreground">
                                        {isLoading ? (
                                            <>
                                                <Clock className="w-4 h-4 mr-2 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4 mr-2" />
                                                {mode === "create" ? "Create Task" : "Save Changes"}
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </DialogFooter>

                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default TaskDialog;