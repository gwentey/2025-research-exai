import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { UserNameDisplayComponent } from './user-name-display.component';

describe('UserNameDisplayComponent', () => {
  let component: UserNameDisplayComponent;
  let fixture: ComponentFixture<UserNameDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        UserNameDisplayComponent,
        MatTooltipModule,
        NoopAnimationsModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserNameDisplayComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the provided displayName', () => {
    const testName = 'Jean Dupont';
    component.displayName = testName;
    fixture.detectChanges();

    const nameElement = fixture.debugElement.query(By.css('h4'));
    expect(nameElement.nativeElement.textContent.trim()).toBe(testName);
  });

  it('should start with default font size f-s-16', () => {
    component.displayName = 'Test';
    fixture.detectChanges();

    expect(component.currentFontSize).toBe('f-s-16');
  });

  it('should apply base class to element', () => {
    const testClass = 'f-w-600';
    component.baseClass = testClass;
    component.displayName = 'Test';
    fixture.detectChanges();

    const nameElement = fixture.debugElement.query(By.css('h4'));
    expect(nameElement.nativeElement.className).toContain(testClass);
  });

  it('should set aria-label with displayName', () => {
    const testName = 'Jean-Baptiste de Montpensier';
    component.displayName = testName;
    fixture.detectChanges();

    const nameElement = fixture.debugElement.query(By.css('h4'));
    expect(nameElement.nativeElement.getAttribute('aria-label')).toBe(testName);
  });

  it('should apply correct CSS classes when truncated', () => {
    component.isTruncated = true;
    component.displayName = 'Test';
    fixture.detectChanges();

    const classes = component.getClasses();
    expect(classes).toContain('text-ellipsis');
    expect(classes).toContain('text-nowrap');
    expect(classes).toContain('overflow-hidden');
  });

  it('should return tooltip message when shouldShowTooltip is true', () => {
    const testName = 'Jean-Baptiste de Montpensier';
    component.displayName = testName;
    component.shouldShowTooltip = true;

    expect(component.getTooltipMessage()).toBe(testName);
  });

  it('should return null for tooltip when shouldShowTooltip is false', () => {
    component.displayName = 'Test';
    component.shouldShowTooltip = false;

    expect(component.getTooltipMessage()).toBeNull();
  });

  it('should set correct inline styles with maxWidth', () => {
    const testWidth = 150;
    component.maxWidth = testWidth;

    const styles = component.getInlineStyles();
    expect(styles['max-width.px']).toBe(testWidth);
    expect(styles['display']).toBe('block');
    expect(styles['width']).toBe('100%');
  });
});