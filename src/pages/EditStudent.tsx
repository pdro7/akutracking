import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const studentFormSchema = z.object({
  // Student Information
  studentFirstName: z.string().min(2, 'First name must be at least 2 characters').max(100, 'First name must be less than 100 characters'),
  studentLastName: z.string().min(2, 'Last name must be at least 2 characters').max(100, 'Last name must be less than 100 characters'),
  dateOfBirth: z.string().optional(),
  schoolName: z.string().optional().refine(val => !val || val.length <= 200, 'School name must be less than 200 characters'),
  gradeLevel: z.string().optional().refine(val => !val || val.length <= 50, 'Grade level must be less than 50 characters'),
  
  // Parent Information
  fatherName: z.string().optional().refine(val => !val || val.length <= 100, 'Name must be less than 100 characters'),
  motherName: z.string().optional().refine(val => !val || val.length <= 100, 'Name must be less than 100 characters'),
  primaryContactPhone: z.string().min(10, 'Phone number must be at least 10 digits').max(20, 'Phone number must be less than 20 digits'),
  primaryContactEmail: z.string().email('Invalid email address').max(255, 'Email must be less than 255 characters'),
  
  // Emergency Contact
  emergencyContactName: z.string().optional().refine(val => !val || val.length <= 100, 'Name must be less than 100 characters'),
  emergencyContactPhone: z.string().optional().refine(val => !val || val.length <= 20, 'Phone number must be less than 20 digits'),
  
  // Additional Information
  address: z.string().optional().refine(val => !val || val.length <= 500, 'Address must be less than 500 characters'),
  medicalConditions: z.string().optional().refine(val => !val || val.length <= 1000, 'Medical conditions must be less than 1000 characters'),
  notes: z.string().optional().refine(val => !val || val.length <= 1000, 'Notes must be less than 1000 characters'),
  
  // Enrollment Details
  packSize: z.string().min(1, 'Pack size is required'),
});

type StudentFormValues = z.infer<typeof studentFormSchema>;

export default function EditStudent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    values: student ? {
      studentFirstName: student.name.split(' ')[0] || '',
      studentLastName: student.name.split(' ').slice(1).join(' ') || '',
      dateOfBirth: student.date_of_birth || '',
      schoolName: student.school_name || '',
      gradeLevel: student.grade_level || '',
      fatherName: student.father_name || '',
      motherName: student.mother_name || '',
      primaryContactPhone: student.phone,
      primaryContactEmail: student.email,
      emergencyContactName: student.emergency_contact_name || '',
      emergencyContactPhone: student.emergency_contact_phone || '',
      address: student.address || '',
      medicalConditions: student.medical_conditions || '',
      notes: student.notes || '',
      packSize: student.pack_size.toString(),
    } : undefined,
  });

  const updateStudentMutation = useMutation({
    mutationFn: async (data: StudentFormValues) => {
      const { error } = await supabase
        .from('students')
        .update({
          name: `${data.studentFirstName} ${data.studentLastName}`,
          email: data.primaryContactEmail,
          phone: data.primaryContactPhone,
          parent_name: data.fatherName || data.motherName || 'Parent',
          father_name: data.fatherName,
          mother_name: data.motherName,
          date_of_birth: data.dateOfBirth || null,
          school_name: data.schoolName,
          grade_level: data.gradeLevel,
          emergency_contact_name: data.emergencyContactName,
          emergency_contact_phone: data.emergencyContactPhone,
          address: data.address,
          medical_conditions: data.medicalConditions,
          notes: data.notes,
          pack_size: parseInt(data.packSize),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student updated successfully!');
      navigate(`/student/${id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const onSubmit = (data: StudentFormValues) => {
    updateStudentMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  if (!student) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Student not found</h2>
          <Button onClick={() => navigate('/students')}>Back to Students</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate(`/student/${id}`)}
        className="mb-6"
      >
        <ArrowLeft className="mr-2" size={20} />
        Back to Student Details
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Edit Student</h1>
        <p className="text-muted-foreground">Update student information below</p>
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
                    <FormLabel>Date of Birth</FormLabel>
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
                    <FormLabel>School Name</FormLabel>
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
                    <FormLabel>Class Pack Size *</FormLabel>
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
              onClick={() => navigate(`/student/${id}`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateStudentMutation.isPending}>
              {updateStudentMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
