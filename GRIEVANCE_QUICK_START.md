# Grievance Management - Quick Start Guide

## For Students

### How to Submit a Grievance

1. **Login** to the system as a student
2. Navigate to **Submit Grievance** from the menu
3. Fill out the form:
   - Select **Category** (Academic, Internship, Faculty, etc.)
   - Choose **Priority** (Low, Medium, High, Urgent)
   - Enter a clear **Subject** (minimum 10 characters)
   - Provide detailed **Description** (minimum 50 characters)
   - Optionally attach files (max 5MB per file)
4. Click **Submit Grievance**
5. Track your grievance in the "My Grievances" table below

### Tracking Your Grievance

Your grievance will go through these stages:
- **Submitted** 🔵 - Your grievance has been received
- **In Review** 🟠 - Being reviewed by staff
- **Escalated** 🔴 - Marked as high priority
- **Resolved** 🟢 - Issue has been resolved
- **Closed** ⚪ - Case closed

Click **View** on any grievance to see:
- Full details and timeline
- Resolution notes (when resolved)
- Current status and assignment

---

## For Administrators (Principal/State Directorate)

### Accessing Grievances

1. Login as Principal or State Directorate
2. Navigate to **Grievances** from the menu
3. You'll see the dashboard with:
   - Total grievances
   - Pending count
   - Escalated count
   - Resolved count

### Managing Grievances

#### Filtering
Use the filters to find specific grievances:
- Filter by **Status** (Submitted, In Review, Escalated, Resolved, Closed)
- Filter by **Category** (Academic, Internship, Faculty, etc.)
- Filter by **Priority** (Low, Medium, High, Urgent)
- Filter by **Date Range**

#### Viewing Details
Click **View** on any grievance to see:
- Student information
- Institution details
- Full description
- Status timeline
- Assignment details

#### Taking Action
From the detail drawer, you can:

1. **Respond**
   - Click the **Respond** button
   - Enter your response
   - This automatically marks the grievance as RESOLVED

2. **Escalate**
   - Click the **Escalate** button
   - Priority is automatically set to URGENT
   - Status changes to ESCALATED

3. **Change Status**
   - Use the status dropdown at the bottom
   - Select new status
   - Changes are saved immediately

4. **Close**
   - Click the **Close** button
   - Confirms the grievance is fully addressed
   - Status changes to CLOSED

### Best Practices

1. **Respond Promptly**
   - Review new grievances daily
   - Acknowledge receipt within 24 hours
   - Aim to resolve within 7 days

2. **Use Escalation Wisely**
   - Escalate genuinely urgent matters
   - Escalated grievances need immediate attention
   - Don't over-escalate

3. **Provide Clear Resolutions**
   - Be specific in your response
   - Explain actions taken
   - Include next steps if applicable

4. **Keep Status Updated**
   - Update status when you start reviewing
   - Mark as resolved when action is complete
   - Close only when student confirms satisfaction

---

## File Locations

### Frontend
- Student submission: `src/features/student/grievances/SubmitGrievance.jsx`
- Admin management: `src/features/shared/grievances/GrievanceList.jsx`
- Service: `src/services/grievance.service.js`
- Constants: `src/constants/grievance.constants.js`

### Backend
- Controller: `src/domain/support/grievance/grievance.controller.ts`
- Service: `src/domain/support/grievance/grievance.service.ts`
- Module: `src/domain/support/support.module.ts`

---

## Common Issues

### "Failed to submit grievance"
- Check that all required fields are filled
- Ensure subject is at least 10 characters
- Ensure description is at least 50 characters
- Check file size (max 5MB per file)

### "Failed to load grievances"
- Check your internet connection
- Try refreshing the page
- Verify you're logged in
- Contact support if issue persists

### Can't see grievances
- **Students**: You can only see your own grievances
- **Admins**: Check you have the correct role (PRINCIPAL or STATE_DIRECTORATE)
- Check the filters - you might have active filters hiding grievances

---

## API Quick Reference

### Submit Grievance (Student)
```http
POST /api/grievances
Content-Type: application/json

{
  "category": "INTERNSHIP",
  "subject": "Issue with placement",
  "description": "Detailed description of the issue...",
  "priority": "HIGH"
}
```

### Respond to Grievance (Admin)
```http
POST /api/grievances/:id/respond
Content-Type: application/json

{
  "response": "We have addressed your concern by..."
}
```

### Escalate Grievance (Admin)
```http
POST /api/grievances/:id/escalate
```

### Update Status (Admin)
```http
PATCH /api/grievances/:id/status
Content-Type: application/json

{
  "status": "IN_REVIEW"
}
```

---

## Support

For technical issues:
1. Check the full documentation: `GRIEVANCE_MODULE_DOCUMENTATION.md`
2. Review the backend API endpoints
3. Contact the development team

---

**Quick Tips:**
- 🎯 Use appropriate priorities - URGENT should be rare
- 📝 Provide detailed descriptions for faster resolution
- 🔔 Check notifications for updates
- ⏱️ Track time-sensitive issues closely
- 💬 Use professional language in all communications
