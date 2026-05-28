export type LeaveType = "annual" | "sick" | "personal" | "unpaid" | "maternity" | "paternity";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface CreateLeaveRequest {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface ReviewLeaveRequest {
  note?: string;
}

export interface LeaveRequestRecord {
  id: number;
  userId: number;
  employeeName: string;
  employeeEmail: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  reviewerId: number | null;
  reviewerName: string | null;
  reviewerNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequestSnapshot extends LeaveRequestRecord {
  canCancel: boolean;
  canReview: boolean;
}

interface LeaveRequestProps extends LeaveRequestRecord {}

export abstract class LeaveRequestEntity {
  protected constructor(protected readonly props: LeaveRequestProps) {}

  public get id(): number {
    return this.props.id;
  }

  public get userId(): number {
    return this.props.userId;
  }

  public get status(): LeaveStatus {
    return this.props.status;
  }

  public abstract canCancel(actorUserId: number): boolean;
  public abstract canReview(): boolean;

  public toSnapshot(actorUserId: number): LeaveRequestSnapshot {
    return {
      ...this.props,
      canCancel: this.canCancel(actorUserId),
      canReview: this.canReview(),
    };
  }

  public static fromRecord(record: LeaveRequestRecord): LeaveRequestEntity {
    if (record.status === "pending") {
      return new PendingLeaveRequest(record);
    }

    if (record.status === "cancelled") {
      return new CancelledLeaveRequest(record);
    }

    return new ReviewedLeaveRequest(record);
  }
}

export class PendingLeaveRequest extends LeaveRequestEntity {
  public canCancel(actorUserId: number): boolean {
    return this.userId === actorUserId;
  }

  public canReview(): boolean {
    return true;
  }
}

export class ReviewedLeaveRequest extends LeaveRequestEntity {
  public canCancel(): boolean {
    return false;
  }

  public canReview(): boolean {
    return false;
  }
}

export class CancelledLeaveRequest extends LeaveRequestEntity {
  public canCancel(): boolean {
    return false;
  }

  public canReview(): boolean {
    return false;
  }
}
