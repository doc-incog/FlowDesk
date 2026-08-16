import '../../models/complaint.dart';

abstract class ComplaintsRepository {
  List<Complaint> getComplaints();
  List<Complaint> addComplaint(Complaint complaint);
  List<Complaint> addComment(String complaintId, ComplaintComment comment);
  List<Complaint> markResolved(String complaintId);
}
