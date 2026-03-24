export enum ClickError {
  Success = 0,
  SignCheckFailed = -1,
  InvalidAmount = -2,
  ActionNotFound = -3,
  AlreadyPaid = -4,
  OrderNotFound = -5,
  TransactionNotFound = -6,
  UpdateFailed = -7,
  BadRequest = -8,
  TransactionCancelled = -9,
}

export const ClickErrorMessages: Record<ClickError, string> = {
  [ClickError.Success]: "Success",
  [ClickError.SignCheckFailed]: "SIGN CHECK FAILED!",
  [ClickError.InvalidAmount]: "Incorrect parameter amount",
  [ClickError.ActionNotFound]: "Action not found",
  [ClickError.AlreadyPaid]: "Already paid",
  [ClickError.OrderNotFound]: "User/Order not found",
  [ClickError.TransactionNotFound]: "Transaction does not exist",
  [ClickError.UpdateFailed]: "Failed to update order",
  [ClickError.BadRequest]: "Error in request from click",
  [ClickError.TransactionCancelled]: "Transaction cancelled",
};

export enum ClickAction {
  Prepare = 0,
  Complete = 1,
}
