import { ClickError } from "../enums";

export interface ClickPrepareResponse {
  click_trans_id: string;
  merchant_trans_id: string;
  merchant_prepare_id: string | null;
  error: ClickError;
  error_note: string;
}

export interface ClickCompleteResponse {
  click_trans_id: string;
  merchant_trans_id: string;
  merchant_confirm_id: string | null;
  error: ClickError;
  error_note: string;
}
