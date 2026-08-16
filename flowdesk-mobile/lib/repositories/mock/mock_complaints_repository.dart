import '../../data/helpdesk_data.dart' as data;
import '../../models/complaint.dart';
import '../contract/complaints_repository.dart';
import '../persisted_store.dart';

const _complaintsKey = 'flowdesk.complaints';

class MockComplaintsRepository implements ComplaintsRepository {
  MockComplaintsRepository(this._store);

  final PersistedStore _store;

  @override
  List<Complaint> getComplaints() =>
      _store.load(_complaintsKey, data.seedComplaints, (c) => c.toJson(), Complaint.fromJson);

  @override
  List<Complaint> addComplaint(Complaint complaint) {
    final next = [complaint, ...getComplaints()];
    _store.save(_complaintsKey, next, (c) => c.toJson());
    return next;
  }

  @override
  List<Complaint> addComment(String complaintId, ComplaintComment comment) {
    final next = getComplaints()
        .map((c) => c.id == complaintId
            ? c.copyWith(comments: [...c.comments, comment])
            : c)
        .toList();
    _store.save(_complaintsKey, next, (c) => c.toJson());
    return next;
  }

  @override
  List<Complaint> markResolved(String complaintId) {
    final next = getComplaints()
        .map((c) => c.id == complaintId ? c.copyWith(status: ComplaintStatus.resolved) : c)
        .toList();
    _store.save(_complaintsKey, next, (c) => c.toJson());
    return next;
  }
}
