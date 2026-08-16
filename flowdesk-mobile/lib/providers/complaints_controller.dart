import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/complaint.dart';
import 'repositories.dart';

class ComplaintsController extends Notifier<List<Complaint>> {
  @override
  List<Complaint> build() {
    return ref.watch(complaintsRepositoryProvider).getComplaints();
  }

  void add(Complaint complaint) {
    state = ref.read(complaintsRepositoryProvider).addComplaint(complaint);
  }

  void addComment(String id, ComplaintComment comment) {
    state = ref.read(complaintsRepositoryProvider).addComment(id, comment);
  }

  void markResolved(String id) {
    state = ref.read(complaintsRepositoryProvider).markResolved(id);
  }
}

final complaintsProvider =
    NotifierProvider<ComplaintsController, List<Complaint>>(ComplaintsController.new);
