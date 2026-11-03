import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createFlaggedRecord } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { notifyUsersOfFlag } from "@/lib/directus";

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import PageIntro from "@/components/dashboard/PageIntro";
import GlowCard from "@/components/aceternity/GlowCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  comment: z.string().min(1, { message: "Please enter a comment" }),
});

const FlaggedRecordForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Extract household data from location state
  const householdData = location.state?.household || {};
  const {
    household_id = "Not Available",
    caseworker_phone = "Not Available",
    caseworker_name = "Not Available",
    caregiver_name = "Not Available",
    facility = "Not Available",
    vca_id = "Not Available",
  } = householdData;

  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      comment: "",
    },
  });

  const mutation = useMutation({
    mutationFn: createFlaggedRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flagged-records"] });

      // Broadcast notification to all users
      const verifier = user ? `${user.first_name} ${user.last_name}` : "Unknown Verifier";
      notifyUsersOfFlag(household_id, verifier, form.getValues("comment"), vca_id);

      toast.success("Flagged record created successfully", {
        description: "Your comment has been submitted to the caseworker.",
      });
      navigate(-1); // Go back
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to submit flagged record.");
      toast.error("Submission failed", {
        description: err.message || "Please try again later.",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setError(null);
    const verifier = user ? `${user.first_name} ${user.last_name}` : "Unknown Verifier";

    const payload = {
      household_id,
      vca_id,
      caseworker_phone,
      caseworker_name,
      caregiver_name,
      facility,
      comment: values.comment,
      verifier,
      status: "pending",
    };

    mutation.mutate(payload);
  };

  if (!location.state?.household) {
    return (
      <DashboardLayout subtitle="Flag record">
        <PageIntro
          eyebrow="Flags"
          title="Flag record"
          description="Create a new flagged record entry."
        />
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <AlertCircle className="h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No household selected</h3>
          <p className="text-slate-500 max-w-sm mt-2 mb-6">
            This form requires a household context. Please navigate from a household profile.
          </p>
          <Button onClick={() => navigate("/households")}>
            Go to Households
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout subtitle="Flag record">
      <PageIntro
        eyebrow="Compliance"
        title="Flag record form"
        description="Add a comment for the caseworker regarding this household."
        actions={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        }
      />

      <div className="max-w-3xl mx-auto">
        <GlowCard className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <Flag className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Household details</CardTitle>
                <CardDescription>Reference information for this flag</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-6">
            <DetailItem label="Household ID" value={household_id} />
            <DetailItem label="Caregiver Name" value={caregiver_name} />
            <DetailItem label="Caseworker Name" value={caseworker_name} />
            <DetailItem label="Caseworker Phone" value={caseworker_phone} />
            <DetailItem label="Facility" value={facility} />
            {vca_id !== "Not Available" && <DetailItem label="VCA ID" value={vca_id} />}
          </CardContent>
        </GlowCard>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Add comment</CardTitle>
            <CardDescription>
              Provide detailed feedback or instructions for the caseworker.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comment <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter your comment here..."
                          className="min-h-[120px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={mutation.isPending}
                    className="min-w-[150px]"
                  >
                    {mutation.isPending ? (
                      <>
                        <LoadingDots className="h-4" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Submit flag
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <p className="text-xs font-semibold tracking-wider text-slate-500">{label}</p>
    <p className="text-sm font-medium text-slate-900 bg-slate-50 px-3 py-2 rounded-md border border-slate-100">
      {value}
    </p>
  </div>
);

export default FlaggedRecordForm;
