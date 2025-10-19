import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const studentFormSchema = z.object({
  // Student Information
  studentFirstName: z.string().min(2, 'First name must be at least 2 characters'),
  studentLastName: z.string().min(2, 'Last name must be at least 2 characters'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  schoolName: z.string().min(2, 'School name is required'),
  gradeLevel: z.string().optional(),
  
  // Parent Information
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  primaryContactPhone: z.string().min(10, 'Phone number must be at least 10 digits'),
  primaryContactEmail: z.string().email('Invalid email address'),
  
  // Emergency Contact
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  
  // Additional Information
  address: z.string().optional(),
  medicalConditions: z.string().optional(),
  notes: z.string().optional(),
  
  // Enrollment Details
  packSize: z.string().min(1, 'Pack size is required'),
});

type StudentFormValues = z.infer<typeof studentFormSchema>;

export default function NewStudent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      studentFirstName: '',
      studentLastName: '',
      dateOfBirth: '',
      schoolName: '',
      gradeLevel: '',
      fatherName: '',
      motherName: '',
      primaryContactPhone: '',
      primaryContactEmail: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      address: '',
      medicalConditions: '',
      notes: '',
      packSize: '10',
    },
  });

  const addStudentMutation = useMutation({
    mutationFn: async (data: StudentFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('students').insert({
        name: `${data.studentFirstName} ${data.studentLastName}`,
        email: data.primaryContactEmail,
        phone: data.primaryContactPhone,
        parent_name: data.fatherName || data.motherName || 'Parent',
        enrollment_date: new Date().toISOString().split('T')[0],
        pack_size: parseInt(data.packSize),
        classes_remaining: parseInt(data.packSize),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student added successfully!');
      navigate('/students');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const onSubmit = (data: StudentFormValues) => {
    addStudentMutation.mutate(data);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/students')}
        className="mb-6"
      >
        <ArrowLeft className="mr-2" size={20} />
        Back to Students
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Add New Student</h1>
        <p className="text-muted-foreground">Fill in the student information below</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Student Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Student Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="studentFirstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter first name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="studentLastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter last name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gradeLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade Level</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 5th Grade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="schoolName"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>School Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter school name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          {/* Parent Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Parent/Guardian Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fatherName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Father's Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter father's name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="motherName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mother's Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter mother's name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="primaryContactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Contact Phone *</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="primaryContactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Contact Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter home address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          {/* Emergency Contact */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Emergency Contact</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="emergencyContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter emergency contact name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergencyContactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          {/* Additional Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Additional Information</h2>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="medicalConditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medical Conditions / Allergies</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter any medical conditions or allergies"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter any additional notes"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          {/* Enrollment Details */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Enrollment Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="packSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Class Pack Size *</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          {/* Form Actions */}
          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/students')}
            >
              Cancel
            </Button>
            <Button type="submit">
              Add Student
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
