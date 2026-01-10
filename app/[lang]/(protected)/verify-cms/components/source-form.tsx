"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createApiSource } from "@/lib/actions/cms";

const initialState = {
  success: false,
  timestamp: 0,
  message: "",
};

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.url("Must be a valid URL"),
});

export default function SourceForm() {
  const [state, dispatch, isPending] = React.useActionState(
    createApiSource,
    initialState,
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "",
    },
  });

  const onSubmit: React.ReactEventHandler<
    React.ComponentRef<"button">
  > = async (e) => {
    e.preventDefault();
    const currentTarget = e.currentTarget;
    const isValid = await form.trigger();
    if (!isValid) return;
    currentTarget.form?.requestSubmit();
  };

  React.useEffect(() => {
    if (state.success) form.reset();
  }, [state, form.reset]);

  return (
    <Form {...form}>
      <form
        action={dispatch}
        className="flex flex-wrap gap-4 w-full items-end border p-4 rounded-lg bg-secondary border-border"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Source Name"
                  className="bg-background"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem className="flex-2">
              <FormLabel>API URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://example.com/api.php/provide/vod"
                  className="bg-background"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending} onClick={onSubmit}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Add Source
        </Button>
        <FormMessage className="w-full">
          {!state.success ? state.error : ""}
        </FormMessage>
      </form>
    </Form>
  );
}
