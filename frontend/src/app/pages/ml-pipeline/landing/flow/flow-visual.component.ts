import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-ml-flow-visual',
  standalone: true,
  imports: [CommonModule, MatTooltipModule, MatIconModule, TranslateModule],
  templateUrl: './flow-visual.component.html',
  styleUrls: ['./flow-visual.component.scss']
})
export class MlFlowVisualComponent {
  nodes = [
    { icon: 'storage', labelKey: 'ML_PIPELINE.LANDING.FLOW.DATASET', tipKey: 'ML_PIPELINE.LANDING.FLOW.DATASET_TIP' },
    { icon: 'cleaning_services', labelKey: 'ML_PIPELINE.LANDING.FLOW.CLEAN', tipKey: 'ML_PIPELINE.LANDING.FLOW.CLEAN_TIP' },
    { icon: 'data_thresholding', labelKey: 'ML_PIPELINE.LANDING.FLOW.MISSING', tipKey: 'ML_PIPELINE.LANDING.FLOW.MISSING_TIP' },
    { icon: 'extension', labelKey: 'ML_PIPELINE.LANDING.FLOW.TASK', tipKey: 'ML_PIPELINE.LANDING.FLOW.TASK_TIP' },
    { icon: 'hub', labelKey: 'ML_PIPELINE.LANDING.FLOW.ALGO', tipKey: 'ML_PIPELINE.LANDING.FLOW.ALGO_TIP' },
    { icon: 'model_training', labelKey: 'ML_PIPELINE.LANDING.FLOW.TRAIN', tipKey: 'ML_PIPELINE.LANDING.FLOW.TRAIN_TIP' },
    { icon: 'insights', labelKey: 'ML_PIPELINE.LANDING.FLOW.EVAL', tipKey: 'ML_PIPELINE.LANDING.FLOW.EVAL_TIP' },
    { icon: 'emoji_objects', labelKey: 'ML_PIPELINE.LANDING.FLOW.XAI', tipKey: 'ML_PIPELINE.LANDING.FLOW.XAI_TIP' }
  ];
}

